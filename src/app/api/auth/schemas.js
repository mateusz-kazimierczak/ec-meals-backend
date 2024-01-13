const Joi = require("joi");

export const registerUserSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  birthday: Joi.date().required(),
  role: Joi.string().valid("student", "admin", "numerary").required(),
  active: Joi.boolean(),
});
