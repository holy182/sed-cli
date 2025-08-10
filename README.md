# SED (Semantic Entity Design)

**SED automatically converts your raw database into an AI-ready semantic layer with intelligent business rules.**

[![npm version](https://img.shields.io/npm/v/sed-cli.svg)](https://www.npmjs.com/package/sed-cli)
[![npm downloads](https://img.shields.io/npm/dm/sed-cli.svg)](https://www.npmjs.com/package/sed-cli)

SED creates a semantic layer that makes AI understand your business data instantly, with automatic business rule generation for security and compliance.

## Overview

SED is a local-first database intelligence layer that bridges the gap between technical database schemas and business understanding. It automatically discovers your database structure, generates semantic mappings, and enforces business rules for AI applications.

## What SED Does

### 1. Semantic Layer Generation
SED analyzes your database schema and creates business-friendly semantic mappings:

```json
{
  "entities": [
    {
      "name": "Customer",
      "description": "A person who can place orders and has an account",
      "databaseTable": "users",
      "attributes": [
        {
          "name": "email",
          "description": "Email address",
          "databaseColumn": "email"
        }
      ]
    }
  ]
}
```

### 2. Business Rules Engine
SED automatically generates and enforces business rules:
- **PII Protection**: Blocks access to sensitive data
- **Data Validation**: Ensures data quality standards
- **Access Control**: Role-based permissions
- **Metric Definitions**: Standardized calculations
- **Custom Rules**: Add your own business logic

### 3. Local-First Architecture
- **100% Local Processing**: No data leaves your machine
- **No API Keys Required**: Works offline with pattern matching
- **Privacy-First**: Your database schema stays private

## Quick Start

### 1. Install SED
```bash
npm install -g sed-cli
```

### 2. Initialize Everything
```bash
npx sed init
```

This interactive command will:
- Set up your database connection
- Build your semantic layer
- Generate business rules automatically
- Enable rules by default

**Supported Databases:**
- PostgreSQL
- MySQL  
- SQLite

### 3. Query Your Data
```bash
npx sed query "show me customer orders from last month"
```

Use natural language to query your database. SED automatically:
- Translates your request to SQL
- Applies business rules for safety
- Returns results with compliance

### 4. Manage Business Rules
```bash
# List all rules
npx sed rules --list

# Disable a rule temporarily
npx sed rules --disable pii-protection

# Add custom rules
npx sed rules --add custom-rules.json
```

## CLI Commands

### Core Commands
- `sed init` - Initialize SED with database connection and setup everything
- `sed build` - Rebuild semantic layer and business rules
- `sed query <query>` - Query database using natural language
- `sed validate` - Validate semantic layer and business rules
- `sed status` - Show current SED status and configuration

### Business Rules Management
- `sed rules --list` - List all business rules
- `sed rules --add <file>` - Add custom rules from JSON file
- `sed rules --disable <rule-id>` - Disable a specific rule
- `sed rules --enable <rule-id>` - Enable a specific rule

### Export & Import
- `sed export` - Export semantic layer and configuration
- `sed import <file>` - Import configuration from file

## Architecture

### Database Support
- **PostgreSQL**: Full support with schema discovery
- **MySQL**: Comprehensive table and relationship analysis
- **SQLite**: Lightweight file-based database support

### Core Components
- **Connectors**: Database-specific connection management
- **Semantic Layer**: Business entity mapping and discovery
- **Business Logic Engine**: Automatic rule generation and enforcement
- **Security Module**: PII detection and access control
- **Cache Management**: Performance optimization and connection pooling

## Security & Privacy

- **Local Processing**: All analysis happens on your machine
- **External Calls Off by Default**: Anonymous usage analytics are opt-in via `SED_ANALYTICS=true`
- **Business Rules**: Automatic PII protection and data validation
- **Environment Variables**: Secure credential management
- **Input Validation**: SQL injection protection

## Business Rules Engine

### Auto-Generated Rules
SED automatically creates business rules based on your database:

```json
{
  "id": "pii-protection",
  "name": "PII Protection",
  "type": "access_policy",
  "severity": "block",
  "condition": {
    "type": "pattern",
    "pattern": ".*(ssn|password|email).*"
  },
  "action": {
    "type": "deny",
    "message": "Access to PII columns is not allowed"
  }
}
```

### Rule Types
- **Access Policy**: Control who can access what data
- **Data Validation**: Enforce data quality standards
- **Metric Definitions**: Standardize business calculations
- **Join Rules**: Ensure proper table relationships
- **Custom Rules**: Your own business logic

### Rule Management
```bash
# See what rules exist
sed rules --list

# Filter rules by type
sed rules --list --type access_policy

# Add custom business hours rule
sed rules --add business-hours.json

# Disable PII protection temporarily
sed rules --disable pii-protection
```

## Use Cases

### AI Integration
- Provide semantic context to LLMs
- Enable natural language database queries
- Bridge the gap between technical and business terminology

### Data Governance
- Automatic PII protection
- Data quality enforcement
- Compliance rule management

### Development
- Understand complex database schemas
- Discover business entities and relationships
- Generate semantic layer for applications

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
```bash
git clone https://github.com/holy182/sed-cli.git
cd sed-cli
npm install
npm run build
npm test
```

### Running Tests
```bash
npm test
npm run test:security
```

## License

GNU Affero General Public License v3.0 (AGPL-3.0) - see [LICENSE](LICENSE) file for details.

**Important**: This software is licensed under the AGPL-3.0 license. If you modify and distribute this software, you must make your source code available under the same license. This ensures that improvements to SED's security and governance capabilities are shared back with the community.

## Support

- **Issues**: [GitHub Issues](https://github.com/holy182/sed-cli/issues)
- **Discussions**: [GitHub Discussions](https://github.com/holy182/sed-cli/discussions)
- **Documentation**: [Wiki](https://github.com/holy182/sed-cli/wiki) 