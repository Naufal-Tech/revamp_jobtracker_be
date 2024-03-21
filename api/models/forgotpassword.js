import moment from "moment-timezone";
import mongoose from "mongoose";

const defaultDate = moment().tz("Asia/Jakarta").format();

// Define the schema for the ForgotPasswordDB collection
const forgotPasswordSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  token: {
    type: String,
    required: true,
  },

  /* CONFIG */
  created_at: {
    type: Date,
    default: defaultDate,
    expires: 180, // Document will expire and be automatically deleted after 3 minutes
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

  deleted_at: Date,

  deleted_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
});

// Create the model for the ForgotPasswordDB collection
const ForgotPasswordDB = mongoose.model(
  "forgotpassword",
  forgotPasswordSchema,
  "forgotpassword"
);

export default ForgotPasswordDB;
