import moment from "moment-timezone";
import mongoose from "mongoose";

const defaultDate = moment.tz(Date.now(), "Asia/Jakarta");

const TokenVerifikasiSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    unique: true,
  },
  token: {
    type: String,
  },

  /* CONFIG */
  created_at: {
    type: Date,
    default: defaultDate,
    expires: 3600, //1 jam
  },

  updated_at: {
    type: Date,
  },

  created_by: {
    type: String,
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

const TokenVerifikasiDB = mongoose.model(
  "token-verifikasi",
  TokenVerifikasiSchema,
  "token-verifikasi"
);

export default TokenVerifikasiDB;
