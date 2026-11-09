require('dotenv').config();
module.exports = {
  DATABASE_URL: process.env.DATABASE_URL,
  ADMIN_USER: process.env.ADMIN_USER,
  ADMIN_PASS: process.env.ADMIN_PASS,
  OFFICIAL_NAME: process.env.OFFICIAL_NAME || "U2U Oficial"
};
