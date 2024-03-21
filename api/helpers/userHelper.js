const createToken = async (user, organization_id, secret, expiresIn) => {
  const { _id } = user;
  return await jwt.sign({ _id, organization_id }, secret, {
    expiresIn, //set expire token
  });
};

const createTokenVerify = async (user, secret, expiresIn) => {
  const { _id } = user;
  return await jwt.sign({ _id }, secret, {
    expiresIn, //set expire token
  });
};

const generateToken = (payload) => {
  try {
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_LIFETIME,
    });
    return token;
  } catch (error) {
    console.error("Error generating token:", error);
    throw new Error("Unable to generate token");
  }
};

const verifyToken = async (token) => {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await models.UserDB.findById(decoded.id).select("-password");
    return { user };
  } catch (error) {
    console.log("Error generating verify token:", error);
    return null;
  }
};

const sendError = async (res, error, statusCode = 401) => {
  res.status(statusCode).json({ error });
};

const generateOTP = (otp_length = 4) => {
  let OTP = "";
  for (let i = 1; i <= otp_length; i++) {
    const randomVal = Math.round(Math.random() * 9);
    OTP += randomVal;
  }
  return OTP;
};

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
}

export {
  createToken,
  createTokenVerify,
  generateOTP,
  generateToken,
  hashPassword,
  sendError,
  verifyToken,
};
