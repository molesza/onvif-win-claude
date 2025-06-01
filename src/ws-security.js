/**
 * WS-Security implementation for ONVIF authentication
 */

const crypto = require('crypto');

class WSSecurityAuth {
    constructor(username, password, logger) {
        this.username = username;
        this.password = password;
        this.logger = logger;
    }

    /**
     * Validate WS-Security digest authentication
     * @param {Object} security - The Security header from SOAP request
     * @returns {boolean} - True if authentication is valid
     */
    validateDigest(security) {
        try {
            if (!security || !security.UsernameToken) {
                this.logger.debug('No UsernameToken found in security header');
                return false;
            }

            const token = security.UsernameToken;
            
            // Extract values
            const username = token.Username;
            const passwordDigest = token.Password.$value;
            const nonce = token.Nonce.$value;
            const created = token.Created;

            // Check username
            if (username !== this.username) {
                this.logger.debug(`Username mismatch: expected ${this.username}, got ${username}`);
                return false;
            }

            // Decode nonce from base64
            const nonceBuffer = Buffer.from(nonce, 'base64');

            // Calculate expected digest
            // PasswordDigest = Base64(SHA-1(Base64Decode(Nonce) + Created + Password))
            const hash = crypto.createHash('sha1');
            hash.update(nonceBuffer);
            hash.update(created);
            hash.update(this.password);
            const expectedDigest = hash.digest('base64');

            // Compare digests
            const isValid = passwordDigest === expectedDigest;
            
            if (!isValid) {
                this.logger.debug(`Password digest mismatch`);
                this.logger.debug(`Expected: ${expectedDigest}`);
                this.logger.debug(`Received: ${passwordDigest}`);
            } else {
                this.logger.debug(`Authentication successful for user: ${username}`);
            }

            return isValid;

        } catch (error) {
            this.logger.error(`Error validating WS-Security: ${error.message}`);
            return false;
        }
    }

    /**
     * Create authentication middleware for SOAP services
     */
    createAuthMiddleware() {
        return (args, callback, headers, req) => {
            // Check if security header exists
            if (!headers || !headers.Security) {
                this.logger.warn('No security header provided');
                return callback({
                    Fault: {
                        Code: {
                            Value: "soap:Sender",
                            Subcode: { Value: "ter:NotAuthorized" }
                        },
                        Reason: { Text: "Authentication required" }
                    }
                });
            }

            // Validate authentication
            if (!this.validateDigest(headers.Security)) {
                this.logger.warn('Authentication failed');
                return callback({
                    Fault: {
                        Code: {
                            Value: "soap:Sender", 
                            Subcode: { Value: "ter:NotAuthorized" }
                        },
                        Reason: { Text: "Authentication failed" }
                    }
                });
            }

            // Authentication successful - continue to method
            return true;
        };
    }
}

module.exports = WSSecurityAuth;