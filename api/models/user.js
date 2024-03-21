import moment from "moment-timezone";
import mongoose from "mongoose";
import validator from "validator";

const defaultDate = moment.tz(Date.now(), "Asia/Jakarta");

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Please provide username"],
    minlength: 3,
    maxlength: 20,
    trim: true,
  },

  email: {
    type: String,
    required: [true, "Please provide email"],
    validate: {
      validator: validator.isEmail,
      message: "Please provide a valid email",
    },
    unique: true,
  },

  role: {
    type: String,
    enum: ["Admin", "User"],
    default: "User",
  },

  password: {
    type: String,
    required: [true, "Please provide password"],
    minlength: 6,
  },

  firstName: {
    type: String,
    trim: true,
    minlength: 3,
    maxlength: 20,
    trim: true,
  },

  lastName: {
    type: String,
    trim: true,
    minlength: 3,
    maxlength: 20,
  },

  location: {
    type: String,
    trim: true,
    minlength: 3,
    maxlength: 20,
    trim: true,
    default: "my city",
  },

  slug: {
    type: String,
  },

  img_profile: {
    type: String,
    default: null,
  },

  img_profilePublic: {
    type: String,
    default: null,
  },

  isVerified: {
    type: Boolean,
    default: false,
  },

  /* CONFIG */
  created_at: {
    type: Date,
    default: defaultDate,
  },

  updated_at: {
    type: Date,
  },

  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },

  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },

  deleted_at: {
    type: Date,
  },

  deleted_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
});

// Remove Password:
UserSchema.methods.toJSON = function () {
  let obj = this.toObject();
  delete obj.password;
  return obj;
};

// Slugify
UserSchema.pre("save", function (next) {
  this.slug = slugify(this.username, { lower: true });
  next();
});

// Generate Auth Token
UserSchema.methods.generateAuthToken = function () {
  const token = jwt.sign(
    { _id: this._id, email: this.email },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_LIFETIME,
    }
  );
  return token;
};

// Compared Password
UserSchema.methods.comparePassword = async function comparePassword(
  candidatePassword
) {
  try {
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    return isMatch;
  } catch (error) {
    throw new Error("Password comparison failed");
  }
};

const UserDB = mongoose.model("user", UserSchema, "user");

export default UserDB;
