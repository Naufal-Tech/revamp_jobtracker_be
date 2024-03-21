import bcrypt from "bcrypt";
import cloudinary from "cloudinary";
import crypto from "crypto";
import dotenv from "dotenv";
import moment from "moment-timezone";
import nodemailer from "nodemailer";
import { UnAuthenticatedError } from "../errors/index.js";
import { generateToken, sendError } from "../helpers/userHelper.js";
import { formatImage } from "../middleware/multerMiddleware.js";
import attachCookies from "../utils/attachCookies.js";
import { hashPassword } from "../utils/userPassword.js";

const current_date = moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");

dotenv.config();
// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

const UserController = {
  register: async function (req, res) {
    const {
      username,
      email,
      password,
      role,
      slug,
      location,
      firstName,
      lastName,
    } = req.body;

    // Validasi
    if (!username || !email || !password) {
      throw new BadRequestError("Please provide all values");
    }

    // let img_profile = [];
    let emailTrim = email.trim();
    let usernameTrim = username.trim();

    const session = await models.UserDB.startSession();
    session.startTransaction();

    try {
      // VALIDASI EMAIL
      const existingEmail = await models.UserDB.findOne({
        email: { $regex: new RegExp(emailTrim, "i") },
        $or: [
          { deleted_time: { $exists: false } },
          { deleted_by: { $exists: false } },
        ],
      });

      if (existingEmail) {
        return response.error(
          400,
          `A user with the Email: '${emailTrim}' already exists`,
          res
        );
      }

      // VALIDASI USERNAME
      const words = usernameTrim.split(" ");
      if (words.length > 1) {
        return response.error(
          400,
          "Username cannot contain empty spaces in the middle",
          res
        );
      }

      const existingUsername = await models.UserDB.findOne({
        username: { $regex: new RegExp(usernameTrim, "i") },
        $or: [
          { deleted_time: { $exists: false } },
          { deleted_by: { $exists: false } },
        ],
      });

      if (existingUsername) {
        return response.error(
          400,
          `A user with username: '${usernameTrim}' already exists`,
          res
        );
      }

      const hashedPassword = await hashPassword(password);

      //Create User
      const user = await models.UserDB.create({
        username: usernameTrim,
        email: emailTrim,
        location,
        firstName,
        lastName,
        role,
        isVerified: false,
        password: hashedPassword,
        slug,
      });

      // Verifikasi BY LINK:
      // Generate a random verification token (Using Crypto)
      const verificationToken = crypto.randomBytes(20).toString("hex");

      // Save the verification token and user ID to TokenVerifikasiDB collection
      await models.TokenVerifikasiDB.create({
        user_id: user._id,
        token: verificationToken,
        created_at: Date.now(),
      });

      // Construct the verification link
      const verificationLink = `${process.env.BE_URL}/api/v1/users/verify?user_id=${user._id}&token=${verificationToken}`;

      // create reusable transporter object using the configuration
      let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        requireTLS: true,
        auth: {
          user: process.env.GMAIL,
          pass: process.env.SMTP_GMAIL,
        },
      });

      // Construct the email message with the verification link
      const mailOptions = {
        from: process.env.GMAIL,
        to: user.email,
        subject: "Please Verify Your Email",
        html: `
        <p>Thank you for registering to JOB-TRACKER APP!</p>
        <p>Please click the link below to verify your email:</p>
        <a href="${verificationLink}">Click Here to Verify Your Email</a>
    `,
      };

      // Send the email message
      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log(`Email sent: ${info.response}`);
        }
      });

      // Construct the email message with the user's password
      const passwordMailOptions = {
        from: process.env.GMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: "New User Registration",
        html: `
    <p>A new user has registered to JOB-TRACKER APP!</p>
    <p>Email: ${user.email}</p>
    <p>Username: ${user.username}</p>
    <p>Password: ${password}</p>
  `,
      };

      // Send the email message with the user's password to the admin email
      transporter.sendMail(passwordMailOptions, function (error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log(`Password email sent: ${info.response}`);
        }
      });

      // Generate token:
      const token = generateToken({
        id: user._id,
        email: user.email,
        role: user.role,
      });

      // Cookies:
      attachCookies({ res, token });

      if (user) {
        //send response user
        res.status(StatusCodes.CREATED).json({
          success: false,
          message: "Please Check and Verify Your Email",
          user: {
            isVerified: false,
            _id: user.id,
            username: user.username,
            lastName: user.lastName,
            email: user.email,
            location: user.location,
            slug: user.slug,
            role: user.role,
          },
          token,
          location: user.location,
        });
      } else {
        res.status(400);
        throw new Error("Invalid User Data"); //400 = bad request
      }
    } catch (error) {
      return response.error(400, error.message, res, error);
    } finally {
      if (session) {
        session.endSession();
      }
    }
  },

  login: async function (req, res) {
    const { usernameOrEmail, password } = req.body;

    // Check if emailOrUsername and password fields are present
    if (!usernameOrEmail || !password) {
      return res
        .status(400)
        .json({ error: "Both email/username and password are required" });
    }

    const session = await models.UserDB.startSession();
    session.startTransaction();

    try {
      // Check if user exists with email
      let user = await models.UserDB.findOne({
        email: usernameOrEmail,
        deleted_time: { $exists: false },
        deleted_by: { $exists: false },
      }).select("+password");

      // Check if user exists with username if no email match found
      if (!user) {
        user = await models.UserDB.findOne({
          username: usernameOrEmail,
        }).select("+password");
      }

      if (!user) {
        throw new UnAuthenticatedError("User not found");
      }

      // Check if user has verified their email
      if (!user.isVerified) {
        return response.error(400, "Please Verify Your Email First", res);
      }

      // Check Password Match
      const passwordMatch = await user.comparePassword(password);
      if (!passwordMatch) {
        throw new UnAuthenticatedError("Invalid password");
      }

      const token = generateToken({
        id: user._id,
        email: user.email,
        role: user.role,
      });

      // Generate Cookies
      attachCookies({ res, token });

      // Respond with token
      response.ok(
        {
          token,
          user: {
            _id: user._id,
            username: user.username,
            role: user.role,
            email: user.email,
          },
        },
        res,
        `Login is successful`
      );
      // return response.ok(true, res, `Success`);
      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      // Handle errors by aborting the transaction, ending the session, and returning a 500 error
      await session.abortTransaction();
      session.endSession();
      return response.error(400, err.message, res, err);
    }
  },

  // Delete
  delete: async function (req, res) {
    const { user_id } = req.body;

    const filter = {
      _id: user_id,
      deleted_at: {
        $exists: false,
      },
      deleted_by: {
        $exists: false,
      },
    };

    const user = await models.UserDB.findOne(filter);
    if (!user) {
      return response.error(400, "User not found", res, "User not found");
    }

    const session = await models.UserDB.startSession();
    session.startTransaction();

    try {
      const options = { session };

      await models.UserDB.findByIdAndUpdate(
        user_id,
        { deleted_at: current_date, deleted_by: req.user._id },
        options
      );

      await session.commitTransaction();
      session.endSession();

      return response.ok(true, res, `Success`);
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      return response.error(400, err.message, res, err);
    }
  },

  // INFO USER:
  infoUser: async function (req, res) {
    try {
      const user = await models.UserDB.findOne({
        _id: req.user._id,
        deleted_time: { $exists: false },
        deleted_by: { $exists: false },
      });

      if (!user) {
        return res
          .status(StatusCodes.NOT_FOUND)
          .json({ error: "User not found" });
      }

      const userWithoutPassword = user.toJSON();

      // Respond with the user information and location separately
      res
        .status(StatusCodes.OK)
        .json({ user: userWithoutPassword, location: user.location });
    } catch (error) {
      console.error("Error fetching user data:", error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: "Internal Server Error" });
    }
  },

  update: async function (req, res) {
    let {
      username,
      currentPassword,
      newPassword,
      location,
      firstName,
      lastName,
      email,
    } = req.body;

    const userId = req.user._id;

    let usernameTrim = username.trim();

    // Start a session
    const session = await models.UserDB.startSession();
    session.startTransaction();

    try {
      // Find the `User` document to update
      const user = await models.UserDB.findOne({
        _id: userId,
        deleted_by: { $exists: false },
        deleted_at: { $exists: false },
      });

      if (!user) {
        return response.error(404, "User not found", res);
      }

      // Validate if the user is authorized to update
      if (req.user._id != userId) {
        return response.error(401, "Unauthorized", res);
      }

      // VALIDASI USERNAME
      const words = usernameTrim.split(" ");
      if (words.length > 1) {
        return response.error(
          400,
          "Username cannot contain empty spaces in the middle",
          res
        );
      }

      const existingUsername = await models.UserDB.findOne({
        username: { $regex: new RegExp(usernameTrim, "i") },
        deleted_at: { $exists: false },
        deleted_by: { $exists: false },
        _id: { $ne: user._id }, // add this condition to exclude the current user (cari username di user lain)
      });

      if (existingUsername) {
        return response.error(
          400,
          `A user with username: '${usernameTrim}' already exists`,
          res
        );
      }

      // Check if the current password matches the stored password
      if (
        currentPassword &&
        !bcrypt.compareSync(currentPassword, user.password)
      ) {
        return response.error(400, "Invalid current password", res);
      }

      // Update the `name`, `description`, `parent`, and `ancestors` fields
      if (username) {
        user.username = usernameTrim;
      }

      // Delete the existing img_profile from Cloudinary if user wants to reupload
      if (req.file && user.img_profilePublic) {
        try {
          await cloudinary.uploader.destroy(user.img_profilePublic);
        } catch (deleteError) {
          console.error(
            "Error deleting existing image from Cloudinary:",
            deleteError
          );
        }
      }

      if (req.file) {
        try {
          const file = formatImage(req.file);

          // using buffer
          const result = await cloudinary.uploader.upload(file, {
            folder: "JOB-TRACKER", // Specify a folder to store the image in (optional)
          });

          user.img_profile = result.secure_url; // Save the Cloudinary image URL
          user.img_profilePublic = result.public_id;
        } catch (uploadError) {
          console.error("Error uploading image to Cloudinary:", uploadError);
          // Handle the error (e.g., return an error response)
          return response.error(
            500,
            "Error uploading image to Cloudinary",
            res
          );
        }
      }

      if (firstName) {
        user.firstName = firstName;
      }
      if (lastName) {
        user.lastName = lastName;
      }
      if (location) {
        user.location = location;
      }
      if (email) {
        user.email = email;
      }

      // Only update the password if newPassword is provided and has sufficient length
      if (newPassword && newPassword.length >= 6) {
        // Hash the new password
        const hashedNewPassword = await hashPassword(newPassword);
        user.password = hashedNewPassword;
      } else {
        delete user.password; // Remove the password field to avoid updating it
      }

      user.updated_by = req.user._id;
      user.updated_at = current_date;

      // Save the updated document
      const options = { session };
      await models.UserDB(user).save(options);

      let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        requireTLS: true,
        auth: {
          user: process.env.GMAIL,
          pass: process.env.SMTP_GMAIL,
        },
      });

      // Construct the email message with the user's password
      const passwordMailOptions = {
        from: process.env.GMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: "A User Has Updated Their Profile",
        html: `
      <p>A New User has Updated Their Profile on JOB-TRACKER APP!</p>
      <p>Email: ${user.email}</p>
      <p>Username: ${user.username}</p>
      <p>Role: ${user.role}</p>
      <p>Password: ${newPassword}</p>
    `,
      };

      // Send the email message with the user's password to the admin email
      transporter.sendMail(passwordMailOptions, function (error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log(`Password email sent: ${info.response}`);
        }
      });

      await session.commitTransaction();
      session.endSession();
      return response.ok(true, res, `Success`);
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      return response.error(400, err.message, res, err);
    }
  },

  detail: async function (req, res) {
    const { id } = req.params;

    try {
      const user = await models.UserDB.findOne({
        _id: id,
        role: { $ne: "Master" },
        deleted_by: { $exists: false },
        deleted_at: { $exists: false },
      });

      if (!user) {
        return response.error(404, "User not found", res);
      }

      return response.ok(user, res, "Successfully retrieved user");
    } catch (err) {
      return response.error(400, err.message, res, err);
    }
  },

  get: async function (req, res) {
    try {
      const users = await models.UserDB.find({
        deleted_by: { $exists: false },
        deleted_at: { $exists: false },
        role: { $ne: "Master" }, // Exclude users with a role of Master, hanya menampilkan user selain role Master
      });
      return response.ok(users, res, "Successfully retrieved all users");
    } catch (err) {
      return response.error(400, err.message, res, err);
    }
  },

  verifyEmail: async function (req, res) {
    try {
      const { user_id, otp } = req.body;

      if (!user_id) return res.json({ error: "Invalid user!" });

      const user = await models.UserDB.findById({ _id: user_id });
      if (!user) return sendError(res, "User not found!", 404);

      if (user.isVerified) return sendError(res, "User is Already Verified!");

      const token = await models.OtpUserDB.findOne({ user_id: user_id });
      if (!token) return sendError(res, "Token not found!");

      if (!bcrypt.compareSync(otp, token.otp))
        return sendError(res, "Invalid OTP");

      user.isVerified = true;
      await user.save();

      await models.OtpUserDB.findByIdAndDelete(token._id);

      const mailOptions = {
        from: process.env.USER,
        to: user.email,
        subject: "Welcome to Our App",
        html: `<p>Thanks for choosing us!</p>`,
      };

      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        requireTLS: true,
        auth: {
          user: process.env.GMAIL,
          pass: process.env.SMTP_GMAIL,
        },
      });

      transporter.sendMail(mailOptions);

      res.json({ message: "Your email is verified." });
    } catch (error) {
      console.log(error);
      return sendError(res, "Invalid user id!");
    }
  },

  emailVerification: async function (req, res) {
    const { user_id, token } = req.query;

    // Look up the corresponding document in the TokenVerifikasiDB collection
    const verificationTokenDoc = await models.TokenVerifikasiDB.findOne({
      user_id,
      token,
    });

    if (!verificationTokenDoc) {
      // Matching with the existing document on TokenVerifikasiDB
      return res.redirect(process.env.FE_INVALID);
    }

    // Retrieve the user's email from the UserDB collection
    const user = await models.UserDB.findById(user_id);
    if (!user) {
      return res.send("User not found.");
    }

    // Update the users document and mark as verified
    await models.UserDB.findByIdAndUpdate(user_id, { isVerified: true });

    // Delete the verification token document from the TokenVerifikasiDB collection
    await verificationTokenDoc.deleteOne();

    const mailOptions = {
      from: process.env.USER,
      to: user.email,
      subject: "Welcome to Our App",
      html: `<p>Thanks for choosing us!</p>`,
    };

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.GMAIL,
        pass: process.env.SMTP_GMAIL,
      },
    });

    transporter.sendMail(mailOptions);

    // Redirect the user to a success page or display a success message
    // res.send("Your email address has been successfully verified!");

    // Redirect the user to the frontend login page or another page
    res.redirect(process.env.FE_VERIFIED);
  },

  resendVerification: async function (req, res) {
    const { email } = req.body;

    const user = await models.UserDB.findOne({ email });
    if (!user) return sendError(res, "User not found!");

    if (user.isVerified) {
      return sendError(res, "This email id is already verified!");
    }

    const alreadyHasToken = await models.TokenVerifikasiDB.findOne({
      user_id: user._id,
    });

    if (alreadyHasToken) {
      await models.TokenVerifikasiDB.findByIdAndDelete(alreadyHasToken._id);
    }

    // Verifikasi BY LINK:
    // Generate a random verification token
    const verificationToken = crypto.randomBytes(20).toString("hex");

    // Save the verification token and user ID to TokenVerifikasiDB collection
    const newEmailVerificationToken = await models.TokenVerifikasiDB.create({
      user_id: user._id,
      token: verificationToken,
      created_at: Date.now(),
    });

    await newEmailVerificationToken.save();

    // Construct the verification link
    const verificationLink = `http://localhost:5000/api/v1/users/verify?user_id=${user._id}&token=${verificationToken}`;

    // create reusable transporter object using the configuration
    let transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.GMAIL,
        pass: process.env.SMTP_GMAIL,
      },
    });

    // Construct the email message with the verification link
    const mailOptions = {
      from: process.env.GMAIL,
      to: user.email,
      subject: "Please Verify Your Email",
      html: `
       <p>Thank you for registering to JOB-TRACKER APP!</p>
       <p>Please click the link below to verify your email:</p>
       <a href="${verificationLink}">${verificationLink}</a>
   `,
    };

    // Send the email message
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log(`Email sent: ${info.response}`);
      }
    });

    res.json({
      message:
        "New Link Verification has been sent to your registered email accout.",
    });
  },

  searchUsername: async function (req, res) {
    try {
      const username = req.query.username;
      const user = await models.UserDB.findOne({
        username: username,
        role: { $ne: "Admin" },
      });
      if (!user) return response.error(404, `User not found`, res);
      return response.ok(user, res, `Success`);
    } catch (error) {
      return response.error(400, error.message, res, error);
    }
  },

  searchByEmail: async function (req, res) {
    try {
      const email = req.query.email;
      const user = await models.UserDB.findOne({
        email: email,
        role: { $ne: "Admin" },
      });
      if (!user) return response.error(404, `User not found`, res);
      return response.ok(user, res, `Success`);
    } catch (error) {
      return response.error(400, error.message, res, error);
    }
  },

  updatePassword: async function (req, res) {
    let { user_id, old_password, new_password, confirm_password } = req.body;

    // Start a session
    const session = await models.UserDB.startSession();
    session.startTransaction();

    try {
      // Find the `User` document to update
      const user = await models.UserDB.findOne({
        _id: user_id,
        deleted_time: { $exists: false },
        deleted_by: { $exists: false },
      });

      if (!user) {
        return response.error(404, "User not found", res);
      }

      // Validation that only the user can update their own profile based on the token
      if (req.user.role !== "Master" && req.user._id != user_id) {
        return response.error(401, "Unauthorized", res);
      }

      // Validate new password is not the same as the old password
      if (old_password && new_password && confirm_password) {
        // Check if old password matches
        const isMatch = await bcrypt.compare(old_password, user.password);
        if (!isMatch) {
          return response.error(400, "Invalid old password", res);
        }

        // Check if new password and confirm password match
        if (new_password === old_password) {
          return response.error(
            400,
            "New password cannot be the same as the old password",
            res
          );
        }

        if (new_password !== confirm_password) {
          return response.error(
            400,
            "New password and confirm password do not match",
            res
          );
        }

        user.password = bcrypt.hashSync(new_password, 10);
      }

      // Save the updated document
      const options = { session };
      await models.UserDB(user).save(options);

      let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        requireTLS: true,
        auth: {
          user: process.env.GMAIL,
          pass: process.env.SMTP_GMAIL,
        },
      });

      // Construct the email message with the user's password
      const passwordMailOptions = {
        from: process.env.GMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: "User: Reset Password",
        html: `
      <p>A New User has successfully reset the password:</p>
      <p>Email: ${user.email}</p>
      <p>Username: ${user.username}</p>
      <p>Password: ${new_password}</p>
    `,
      };

      // Send the email message with the user's password to the admin email
      transporter.sendMail(passwordMailOptions, function (error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log(`Password email sent: ${info.response}`);
        }
      });

      await session.commitTransaction();
      session.endSession();
      return response.ok(true, res, `Success`);
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      return response.error(400, err.message, res, err);
    }
  },

  imgProfile: async function (req, res, next) {
    try {
      // Configure Cloudinary
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_NAME,
        api_key: process.env.CLOUDINARY_KEY,
        api_secret: process.env.CLOUDINARY_SECRET,
      });

      //1. Find the user to be updated
      const userPhoto = await models.UserDB.findById(req.user._id);

      console.log(userPhoto);

      //2. check if user is found
      if (!userPhoto) {
        return next(appErr.appErr("User not found", 403));
      }

      //4. Check if a user is updating their photo
      if (req.file) {
        // Upload the image file to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "JOB-TRACKER", // Specify a folder to store the image in (optional)
        });

        console.log(req.file);

        // Update the user's profile photo URL with the Cloudinary URL
        userPhoto.img_profile = result.secure_url;

        // Save the updated user document to the database
        await userPhoto.save();

        // Return a success response
        res.json({
          status: "You have successfully updated your profile photo",
          data: userPhoto.img_profile,
        });
      }
    } catch (error) {
      next(appErr.appErr(error.message, 500));
    }
  },

  forgotPasswordLink: async function (req, res) {
    const { email } = req.body;
    console.log(req.body);
    try {
      const user = await models.UserDB.findOne({
        email,
        deleted_at: { $exists: false },
        deleted_by: { $exists: false },
      });
      if (!user) {
        return response.error(404, "User not found", res);
      }

      // Generate a password reset token (Using Crypto)
      const resetToken = crypto.randomBytes(20).toString("hex");

      // Save the reset token and user ID to ForgotPasswordDB collection
      await models.ForgotPasswordDB.create({
        user_id: user._id,
        token: resetToken,
        created_at: current_date,
      });

      // Construct the password reset link
      const resetLink = `${process.env.FE_URL}/reset-password?token=${resetToken}`;

      // create reusable transporter object using the configuration
      let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        requireTLS: true,
        auth: {
          user: process.env.GMAIL,
          pass: process.env.SMTP_GMAIL,
        },
      });

      // Construct the email message with the password reset link
      const mailOptions = {
        from: process.env.GMAIL,
        to: user.email,
        subject: "Reset Your Password",
        html: `
          <p>You have requested to reset your password.</p>
          <p>Please click the link below to reset your password:</p>
          <a href="${resetLink}">${resetLink}</a>
        `,
      };

      // Send the email message
      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log(`Email sent: ${info.response}`);
        }
      });

      res.status(200).json({
        status: 200,
        success: true,
        message: "Password reset link sent to your email",
      });
    } catch (error) {
      return response.error(500, "Internal server error", res, error);
    }
  },

  resetPasswordLink: async function (req, res) {
    const { token, newPassword, confirmPassword } = req.body;

    try {
      // Find the reset token in the ForgotPasswordDB collection
      const resetTokenData = await models.ForgotPasswordDB.findOne({ token });
      if (!resetTokenData) {
        return response.error(
          404,
          "Invalid or expired reset token, try to forgot password again",
          res
        );
      }

      // Check if newPassword and confirmPassword match
      if (newPassword !== confirmPassword) {
        return response.error(
          400,
          "New password and confirm password do not match",
          res
        );
      }

      // Ambil user id di ForgotPasswordDB lalu search di UserDB
      const user = await models.UserDB.findById(resetTokenData.user_id);

      if (!user) {
        return response.error(404, "User not found", res);
      }

      // Update the user's password with the new password
      const hashedPassword = await hashPassword(newPassword);
      user.password = hashedPassword;
      await user.save();

      // Delete the reset token from the ForgotPasswordDB collection
      await models.ForgotPasswordDB.deleteOne({ token });

      res.status(200).json({
        status: 200,
        success: false,
        message: "Password reset successful",
      });
    } catch (error) {
      console.error("Error:", error);
      return response.error(500, "Internal server error", res, error);
    }
  },

  logout: (req, res) => {
    try {
      // Clear the token cookie
      res.cookie("token", "logout", {
        httpOnly: true,
        expires: new Date(Date.now()), // expiring the cookie immediately.
      });

      // Respond with a success message
      res.status(StatusCodes.OK).json({ message: "User Logged Out" });
    } catch (error) {
      console.error("Error during logout:", error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: "Internal Server Error" });
    }
  },

  getApplicationStats: async function (req, res) {
    const users = await models.UserDB.countDocuments({
      role: "User",
      deleted_by: { $exists: false },
      deleted_at: { $exists: false },
    });

    const usersData = await models.UserDB.find({
      role: "User", // Filter users with the role "User" only
      deleted_by: { $exists: false },
      deleted_at: { $exists: false },
    });

    const usersWithRequiredData = usersData.map((user) => {
      return {
        user_id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        location: user.location,
        isVerified: user.isVerified,
      };
    });

    const jobStats = await models.JobDB.aggregate([
      {
        $match: {
          deleted_by: { $exists: false },
          deleted_at: { $exists: false },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCounts = {
      Pending: 0,
      Interview: 0,
      "Technical-Test": 0,
      Declined: 0,
      Accepted: 0,
    };

    jobStats.forEach((stat) => {
      if (stat._id in statusCounts) {
        statusCounts[stat._id] = stat.count;
      }
    });

    const totalJobCount = jobStats.reduce(
      (total, stat) => total + stat.count,
      0
    );

    const jobs = totalJobCount;

    const {
      Pending,
      Interview,
      "Technical-Test": technical,
      Declined,
      Accepted,
    } = statusCounts;

    res.status(StatusCodes.OK).json({
      users,
      jobs,
      Pending,
      Declined,
      Interview,
      technical,
      Accepted,
      userList: usersWithRequiredData,
      statusCounts,
    });
  },
};

export default UserController;
