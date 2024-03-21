import { UnAuthenticatedError } from "../errors/index.js";

const checkPermissions = (requestUserId, resourceUserId) => {
  if (requestUserId.toString() !== resourceUserId.toString()) {
    throw new UnAuthenticatedError("Not Authorized to Access This Route");
  }
};

export default checkPermissions;
