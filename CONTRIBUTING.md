# Contributing to Preventify

Thank you for your interest in contributing to Preventify! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/Preventify.git`
3. Create a new branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Commit your changes: `git commit -m "Add your commit message"`
6. Push to your fork: `git push origin feature/your-feature-name`
7. Create a Pull Request

## Development Setup

### Backend API

```bash
cd api
npm install
cp .env.example .env
# Edit .env with your API keys
npm start
```

### Mobile App

```bash
cd mobile
npm install
cp .env.example .env
# Edit .env with your configuration
npm start
# In another terminal: npm run android
```

## Code Style

- Use consistent formatting (Prettier recommended)
- Follow existing code patterns
- Add comments for complex logic
- Update documentation for API changes

## Testing

- Test your changes on both Android emulator and physical device
- Ensure backend API is running when testing summarization
- Verify microphone permissions work correctly

## Pull Request Guidelines

- Provide a clear description of changes
- Reference any related issues
- Ensure all tests pass
- Update documentation if needed
- Keep commits focused and atomic

## Reporting Issues

When reporting issues, please include:
- Description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, React Native version)
- Relevant logs or error messages

## Questions?

Feel free to open an issue for questions or discussions.

