import { v2 as cloudinary } from "cloudinary";
import moment from "moment-timezone";
import { BadRequestError } from "../errors/index.js";
import checkPermissions from "../utils/checkPermission.js";

const current_date = moment().tz("Asia/Jakarta").format();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

const JobController = {
  createJob: async function (req, res) {
    const { position, company } = req.body;

    // Validasi
    if (!position || !company) {
      throw new BadRequestError("Please Provide All Values");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const jobData = {
        ...req.body,
        created_by: req.user._id,
      };

      const job = await models.JobDB.create([jobData], { session });

      await session.commitTransaction();
      session.endSession();

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: "Job created successfully",
        job: job[0],
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      // Handling error during the job creation process
      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Job creation failed",
      });
    }
  },

  getAllJob: async function (req, res) {
    const { status, jobType, sort, search, page = 1, limit = 10 } = req.query;

    try {
      const queryObject = {
        created_by: req.user._id,
        deleted_at: { $exists: false },
        deleted_by: { $exists: false },
      };

      if (status && status !== "Select") {
        queryObject.status = status;
      }

      if (jobType && jobType !== "Select") {
        queryObject.jobType = jobType;
      }

      if (search) {
        const searchRegExp = new RegExp(search, "i");
        queryObject.$or = [
          { company: searchRegExp },
          { position: searchRegExp },
          { jobLocation: searchRegExp },
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      let sortOption = {}; // Initialize an empty sort object
      if (sort === "Recently") {
        sortOption = { created_at: -1 }; // Sort by created_at in descending order (latest to oldest)
      } else if (sort === "Oldest") {
        sortOption = { created_at: 1 }; // Sort by created_at in ascending order (oldest to latest)
      } else if (sort === "Ascending") {
        sortOption = { position: 1 }; // Sort company name in ascending order (A-Z)
      } else if (sort === "Descending") {
        sortOption = { position: -1 }; // Sort company name in descending order (Z-A)
      } else if (sort === "A-Z") {
        sortOption = { jobType: 1 }; // Sort company name in descending order (Z-A)
      } else if (sort === "Z-A") {
        sortOption = { jobType: -1 }; // Sort company name in descending order (Z-A)
      } else {
        // Default sorting: Latest
        sortOption = { created_at: -1 }; // Sort by created_at in descending order (latest to oldest)
      }

      const jobs = await models.JobDB.find(queryObject)
        .sort(sortOption) // Apply the selected sorting option
        .skip(skip)
        .limit(parseInt(limit));

      const totalJobs = await models.JobDB.countDocuments(queryObject);

      res.status(StatusCodes.OK).json({
        jobs,
        currentPage: page,
        totalJobs,
        numOfPages: Math.ceil(totalJobs / parseInt(limit)),
      });
    } catch (error) {
      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: "Failed to fetch jobs",
      });
    }
  },

  getJob: async function (req, res) {
    const { id: jobId } = req.params;

    try {
      const job = await models.JobDB.findOne({
        _id: jobId,
        deleted_time: { $exists: false },
        deleted_by: { $exists: false },
      });

      if (!job) {
        throw new NotFoundError(
          `Edit Job Failed, Job does not exist with id: ${jobId}`
        );
      }

      // Check if the user is an admin or the job was created by the current user
      if (
        req.user.role === "Admin" ||
        job.created_by.toString() === req.user._id.toString()
      ) {
        res.status(StatusCodes.OK).json({ job });
      } else {
        res.status(StatusCodes.FORBIDDEN).json({
          message:
            "Access denied. You do not have permission to view this job.",
        });
      }
    } catch (error) {
      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: `Edit Job Failed, An error occurred while updating the job with id: ${jobId}`,
      });
    }
  },

  updateJob: async function (req, res) {
    const { id: jobId } = req.params;
    const { company, position } = req.body;

    if (!position || !company) {
      throw new BadRequestError("Please Provide All Values");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const job = await models.JobDB.findOne({
        _id: jobId,
        deleted_time: { $exists: false },
        deleted_by: { $exists: false },
      });

      if (!job) {
        throw new NotFoundError(
          `Edit Job Failed, Job does not exist with id: ${jobId}`
        );
      }

      // Check Permissions, user yang membuat harus sama dengan user yang mengupdate
      checkPermissions(req.user._id, job.created_by);

      req.body.updated_at = current_date;
      req.body.updated_by = req.user._id;

      const updatedJob = await models.JobDB.findOneAndUpdate(
        { _id: jobId },
        req.body,
        {
          new: true,
          runValidators: true,
          session,
        }
      );

      await session.commitTransaction();
      session.endSession();

      res.status(StatusCodes.OK).json({
        success: true,
        message: "Update Job is Success",
        updatedJob,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: `Edit Job Failed, An error occurred while updating the job with id: ${jobId}`,
      });
    }
  },

  deleteJob: async function (req, res) {
    const { id: jobId } = req.params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const job = await models.JobDB.findOne({ _id: jobId });

      if (!job) {
        throw new NotFoundError(
          `Delete Job Failed, Job does not exist with id: ${jobId}`
        );
      }

      // Check Permissions, user yang mendelete harus sama dengan user yang membuat
      checkPermissions(req.user._id, job.created_by);

      // Set deleted_at and deleted_by
      const deletionInfo = {
        deleted_at: current_date,
        deleted_by: req.user._id,
      };

      await models.JobDB.updateOne({ _id: jobId }, deletionInfo, { session });

      await session.commitTransaction();
      session.endSession();

      res
        .status(StatusCodes.OK)
        .json({ success: true, message: "Successfully delete a job" });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: `Delete Job Failed, An error occurred while deleting the job with id: ${jobId}`,
      });
    }
  },

  showStats: async function (req, res) {
    try {
      const userIdNew = new mongoose.Types.ObjectId(req.user._id);

      // Perform the aggregation query to get the stats based on the user id
      let stats = await models.JobDB.aggregate([
        // Match the jobs created by the user with the provided userId
        {
          $match: {
            created_by: userIdNew,
            deleted_time: { $exists: false },
            deleted_by: { $exists: false },
          },
        },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ["$status", "Technical-Test"] },
                "Technical-Test",
                "$status",
              ],
            },
            count: { $sum: 1 },
          },
        },
      ]);
      const defaultStats = {
        pending: stats.find((stat) => stat._id === "Pending")?.count || 0,
        interview: stats.find((stat) => stat._id === "Interview")?.count || 0,
        technical:
          stats.find((stat) => stat._id === "Technical-Test")?.count || 0,
        declined: stats.find((stat) => stat._id === "Declined")?.count || 0,
        accepted: stats.find((stat) => stat._id === "Accepted")?.count || 0,
      };

      let monthlyApplications = await models.JobDB.aggregate([
        {
          $match: {
            created_by: new mongoose.Types.ObjectId(req.user._id),
            deleted_time: { $exists: false },
            deleted_by: { $exists: false },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$created_at" },
              month: { $month: "$created_at" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": -1, "_id.month": -1 } },
        { $limit: 6 },
      ]);

      monthlyApplications = monthlyApplications
        .map((item) => {
          const {
            _id: { year, month },
            count,
          } = item;
          // Convert date to Jakarta/Asia time zone
          const date = moment()
            .month(month - 1)
            .year(year)
            .tz("Asia/Jakarta"); // Set the time zone to Jakarta/Asia

          const indonesianMonth = date.locale("id").format("MMMM YYYY");
          return { date: indonesianMonth, count };
        })
        .reverse();

      // Success response with the job stats
      res
        .status(StatusCodes.OK)
        .json({ success: true, stats, defaultStats, monthlyApplications });
    } catch (error) {
      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to fetch job stats",
      });
    }
  },
};

export default JobController;
