#!/usr/bin/env node
import { ReproMcpServer } from './server.js';
const server = new ReproMcpServer();
server.start().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map