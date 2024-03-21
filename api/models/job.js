import moment from "moment-timezone";
import mongoose from "mongoose";
import { JOB_STATUS, JOB_TYPES } from "../utils/constants.js";

const defaultDate = moment.tz(Date.now(), "Asia/Jakarta");

const JobSchema = new mongoose.Schema({
  company: {
    type: String,
    required: [true, "Please provide company name"],
  },

  position: {
    type: String,
    required: [true, "Please provide email"],
    maxlength: 100,
  },

  status: {
    type: String,
    enum: Object.values(JOB_STATUS),
    default: JOB_STATUS.PENDING,
  },

  jobType: {
    type: String,
    enum: Object.values(JOB_TYPES),
    default: JOB_TYPES.FULLTIME,
  },

  jobLocation: {
    type: String,
    default: "Job Location",
    required: true,
  },

  /* CONFIG */
  created_at: {
    type: Date,
    default: defaultDate,
  },

  updated_at: {
    type: Date,
    default: null,
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

const JobDB = mongoose.model("job", JobSchema, "job");

export default JobDB;
