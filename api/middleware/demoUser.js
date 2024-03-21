import { BadRequestError } from "../errors/index.js";

const demoUser = (req, res, next) => {
  if (req.user.demoUser) {
    throw new BadRequestError("Demo User Cannot Access This Request");
  }
  next();
};

export default demoUser;
