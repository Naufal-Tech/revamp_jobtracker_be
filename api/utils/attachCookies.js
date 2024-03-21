const attachCookies = ({ res, token }) => {
  if (!res || !token) {
    throw new Error(
      "Invalid arguments. Both 'res' and 'token' must be provided."
    );
  }

  const oneDay = 1000 * 10 * 60 * 24;

  // Set the cookie named "token" with the generated token value
  res.cookie("token", token, {
    httpOnly: true,
    expires: new Date(Date.now() + oneDay),
    secure: process.env.NODE_ENV === "production", // Set to true for HTTPS connections in production
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax", // Allow cross-site requests in production
  });
};

export default attachCookies;
