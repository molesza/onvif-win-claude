const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      error.isJoi = true;
      return next(error);
    }
    next();
  };
};

// Auth validators
const loginSchema = Joi.object({
  username: Joi.string().required().min(3),
  password: Joi.string().required().min(6)
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
});

// NVR validators
const createNvrSchema = Joi.object({
  name: Joi.string().required(),
  ip: Joi.string().ip().required(),
  username: Joi.string().required(),
  password: Joi.string().required()
});

const generateConfigSchema = Joi.object({
  channels: Joi.array().items(Joi.number().integer().min(1)).required(),
  startIp: Joi.string().ip().required(),
  basePort: Joi.number().integer().min(1024).max(65535).default(8001)
});

// Container validators
const containerActionSchema = Joi.object({
  action: Joi.string().valid('start', 'stop', 'restart').required()
});

// Alert validators
const createAlertSchema = Joi.object({
  name: Joi.string().required(),
  condition: Joi.object({
    metric: Joi.string().required(),
    operator: Joi.string().valid('>', '<', '>=', '<=', '==').required(),
    threshold: Joi.number().required(),
    duration: Joi.string().required()
  }).required(),
  actions: Joi.array().items(Joi.object({
    type: Joi.string().valid('email', 'webhook').required(),
    to: Joi.string().when('type', {
      is: 'email',
      then: Joi.string().email().required()
    }),
    url: Joi.string().when('type', {
      is: 'webhook',
      then: Joi.string().uri().required()
    })
  })).required()
});

module.exports = {
  validateLogin: validate(loginSchema),
  validateRefresh: validate(refreshSchema),
  validateCreateNvr: validate(createNvrSchema),
  validateGenerateConfig: validate(generateConfigSchema),
  validateContainerAction: validate(containerActionSchema),
  validateCreateAlert: validate(createAlertSchema)
};