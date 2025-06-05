const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    // Find user in database
    global.db.get(
      'SELECT * FROM users WHERE username = ?',
      [username],
      async (err, user) => {
        if (err) {
          return next(err);
        }

        if (!user) {
          return res.status(401).json({
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid username or password'
            }
          });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
          return res.status(401).json({
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid username or password'
            }
          });
        }

        // Generate tokens
        const accessToken = jwt.sign(
          {
            id: user.id,
            username: user.username,
            role: user.role
          },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        const refreshToken = jwt.sign(
          { id: user.id },
          process.env.JWT_SECRET,
          { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
        );

        logger.info(`User logged in: ${username}`);

        res.json({
          token: accessToken,
          refreshToken,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            email: user.email
          }
        });
      }
    );
  } catch (error) {
    next(error);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;

    jwt.verify(refreshToken, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid refresh token'
          }
        });
      }

      // Get updated user data
      global.db.get(
        'SELECT * FROM users WHERE id = ?',
        [decoded.id],
        (err, user) => {
          if (err || !user) {
            return res.status(401).json({
              error: {
                code: 'USER_NOT_FOUND',
                message: 'User not found'
              }
            });
          }

          // Generate new tokens
          const accessToken = jwt.sign(
            {
              id: user.id,
              username: user.username,
              role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
          );

          const newRefreshToken = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
          );

          res.json({
            token: accessToken,
            refreshToken: newRefreshToken
          });
        }
      );
    });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res) {
  // In a production app, you might want to invalidate the token here
  // For now, we'll just return success
  res.json({ message: 'Logged out successfully' });
}

module.exports = {
  login,
  refresh,
  logout
};