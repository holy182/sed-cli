# Contributing to SED

Thank you for your interest in contributing to SED! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Development Setup
1. Fork the repository
2. Clone your fork locally
3. Install dependencies: `npm install`
4. Build the project: `npm run build`
5. Run tests: `npm test`

## Development Workflow

### Code Style
- Use TypeScript for all new code
- Follow existing code formatting (Prettier is configured)
- Run `npm run format` before committing
- Run `npm run lint` to check for issues

### Testing
- Write tests for new features
- Ensure all tests pass: `npm test`
- Run security tests: `npm run test:security`
- Maintain good test coverage

### Commit Messages
Use conventional commit format:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `test:` for test additions
- `refactor:` for code refactoring

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with tests
3. Ensure all tests pass
4. Update documentation if needed
5. Submit a pull request with a clear description

### PR Requirements
- Clear title and description
- Link to related issues
- Include tests for new functionality
- Update documentation if needed
- Ensure CI checks pass

## Areas for Contribution

### High Priority
- Database connector improvements
- Performance optimizations
- Security enhancements
- Documentation improvements

### Medium Priority
- New database support
- Additional business rule types
- CLI command enhancements
- Testing improvements

### Low Priority
- Code refactoring
- Minor bug fixes
- Documentation updates

## Questions or Need Help?

- Open an issue for bugs or feature requests
- Use GitHub Discussions for questions
- Check existing issues and PRs first

## Code of Conduct

We expect all contributors to:
- Be respectful and inclusive
- Focus on technical merit
- Help others learn and grow
- Follow project guidelines

Thank you for contributing to SED!
