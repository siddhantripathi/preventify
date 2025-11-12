# Security Policy

## Supported Versions

We currently support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public issue. Instead, please email the maintainers directly or create a private security advisory.

When reporting a vulnerability, please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will respond to security reports within 48 hours and work to address critical issues as quickly as possible.

## Security Best Practices

- **Never commit `.env` files** - These contain sensitive API keys
- **Use environment variables** for all secrets and API keys
- **Keep dependencies updated** - Regularly update npm packages
- **Review code changes** before merging pull requests
- **Use HTTPS** in production environments

## Known Security Considerations

- The backend API uses CORS - ensure proper CORS configuration in production
- WebSocket connections should use WSS (secure WebSocket) in production
- API keys are stored in environment variables - ensure proper access controls
- Docker model execution runs with system privileges - review Docker security settings

