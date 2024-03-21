import jwt from "jsonwebtoken";
import { UnauthenticatedError } from "../errors/customize-error.js";
import UnAuthenticatedError from "../errors/unauthenticated.js";

const middleware = {
  protect: async (req, res, next) => {
    try {
      let token;

      // Check for token in the Authorization header
      const bearerHeader = req.headers.authorization;
      if (bearerHeader && bearerHeader.startsWith("Bearer ")) {
        token = bearerHeader.split(" ")[1];
      }

      // If token is not found in the header, check for the token cookie
      if (!token) {
        const tokenCookie = req.cookies.token;
        if (!tokenCookie) {
          throw new UnAuthenticatedError("Authentication Invalid");
        }
        token = tokenCookie;
      }

      // Verify token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        throw new UnAuthenticatedError("Invalid token");
      }

      // Check for token expiration
      if (decoded.exp < Date.now() / 1000) {
        throw new UnAuthenticatedError("Token has expired");
      }

      // Get user from the token
      const user = await models.UserDB.findById(decoded.id).select("-password");
      if (!user) {
        throw new UnAuthenticatedError("User not found");
      }

      // Set testUser property based on the email
      const demoUserEmail = process.env.DEMO_USER;
      const authAdmin = process.env.AUTH_ADMIN;
      const demoUser = user.email === demoUserEmail;
      req.user = {
        _id: user._id,
        email: user.email,
        role: user.role,
        demoUser,
        authAdmin,
      };

      next();
    } catch (err) {
      throw new UnauthenticatedError("Authentication Invalid");
    }
  },

  handleAuthenticationError: async function (err, res) {
    if (err instanceof UnAuthenticatedError) {
      return response.unauthorized(null, res, err.message);
    } else if (
      err.name === "JsonWebTokenError" &&
      err.message === "jwt malformed"
    ) {
      return response.unauthorized(null, res, "Invalid token");
    } else if (
      err.name === "JsonWebTokenError" &&
      err.message === "invalid signature"
    ) {
      return response.unauthorized(null, res, "Invalid signature");
    } else {
      return response.unauthorized(null, res, "Unauthorized");
    }
  },

  adminAuthMiddleware: async function (req, res, next) {
    const user = req.user; // Assuming you have middleware that attaches user to req

    if (user.role !== "Admin") {
      throw new UnauthenticatedError("You must be Admin to access this");
    }

    next(); // Proceed to the next middleware or route handler
  },
};

export default middleware;
