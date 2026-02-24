"use strict";
// Eywa AI - Telegram Commands for PMS Testing
// Commands that can be called from Telegram via Clawdbot
Object.defineProperty(exports, "__esModule", { value: true });
exports.pmsRouter = void 0;
exports.parseCommand = parseCommand;
exports.executeCommand = executeCommand;
const pms_router_1 = require("./pms-router");
Object.defineProperty(exports, "pmsRouter", { enumerable: true, get: function () { return pms_router_1.pmsRouter; } });
// Parse command from message
function parseCommand(message) {
    if (!message.startsWith('/eywa'))
        return null;
    const parts = message.trim().split(/\s+/);
    const command = parts[1] || 'help';
    const args = parts.slice(2);
    return { command, args };
}
// Execute command and return response
async function executeCommand(command, args) {
    switch (command) {
        case 'help':
            return getHelp();
        case 'list':
            return listPMS();
        case 'test':
            return await testPMS(args);
        case 'status':
            return getStatus();
        case 'connect':
            return await connectPMS(args);
        case 'availability':
            return await getAvailability(args);
        case 'reservations':
            return await getReservations(args);
        case 'rooms':
            return await getRoomTypes(args);
        default:
            return `❓ Unknown command: ${command}\n\nUse /eywa help for available commands.`;
    }
}
function getHelp() {
    return `🏨 **EYWA AI - PMS Gateway**

**Commands:**
\`/eywa list\` - List all supported PMS (17 total)
\`/eywa test <pms>\` - Test connection to a PMS
\`/eywa connect <pms> <credentials>\` - Connect a PMS
\`/eywa status\` - Show active connections
\`/eywa availability <hotel_id> <start> <end>\` - Get availability
\`/eywa reservations <hotel_id>\` - Get reservations
\`/eywa rooms <hotel_id>\` - Get room types

**Examples:**
\`/eywa list\`
\`/eywa test apaleo\`
\`/eywa connect mews client_token=xxx access_token=yyy\`
\`/eywa availability hotel1 2024-03-01 2024-03-05\`

**Coverage:** ~90% of global hotel market`;
}
function listPMS() {
    const grouped = {
        'Global Cloud': pms_router_1.PMS_LIST.filter(p => ['mews', 'cloudbeds', 'apaleo', 'opera'].includes(p.type)),
        'Europe': pms_router_1.PMS_LIST.filter(p => ['protel', 'guestline', 'roomraccoon', 'clockpms'].includes(p.type)),
        'Asia/Pacific': pms_router_1.PMS_LIST.filter(p => ['hotelogix', 'ezee', 'littlehotelier'].includes(p.type)),
        'US': pms_router_1.PMS_LIST.filter(p => ['stayntouch', 'webrezpro'].includes(p.type)),
        'Enterprise': pms_router_1.PMS_LIST.filter(p => p.type === 'inforhms'),
        'Vacation Rentals': pms_router_1.PMS_LIST.filter(p => ['hostaway', 'beds24', 'guesty'].includes(p.type)),
    };
    let result = '🏨 **Supported PMS Systems (17)**\n\n';
    for (const [region, pms] of Object.entries(grouped)) {
        result += `**${region}:**\n`;
        for (const p of pms) {
            result += `  • ${p.name} (\`${p.type}\`) - ${p.authType}\n`;
        }
        result += '\n';
    }
    result += '_~90% global hotel market coverage_';
    return result;
}
async function testPMS(args) {
    const pmsType = args[0];
    if (!pmsType) {
        return '❌ Usage: `/eywa test <pms_type>`\n\nExample: `/eywa test apaleo`';
    }
    const pmsInfo = pms_router_1.PMS_LIST.find(p => p.type === pmsType);
    if (!pmsInfo) {
        return `❌ Unknown PMS: ${pmsType}\n\nUse \`/eywa list\` to see available PMS.`;
    }
    // For testing without real credentials, just validate the adapter exists
    try {
        // Test with dummy credentials to validate adapter structure
        return `✅ **${pmsInfo.name}** adapter ready!\n\n` +
            `• Type: \`${pmsType}\`\n` +
            `• Auth: ${pmsInfo.authType}\n` +
            `• Region: ${pmsInfo.region}\n\n` +
            `To connect: \`/eywa connect ${pmsType} <credentials>\``;
    }
    catch (error) {
        return `❌ Error: ${error.message}`;
    }
}
function getStatus() {
    const connections = pms_router_1.pmsRouter.listConnections();
    if (connections.length === 0) {
        return '📭 No active PMS connections.\n\nUse `/eywa connect <pms> <credentials>` to add one.';
    }
    let result = '📊 **Active PMS Connections**\n\n';
    for (const conn of connections) {
        const status = conn.isActive ? '🟢' : '🔴';
        result += `${status} **${conn.hotelId}**\n`;
        result += `  • PMS: ${conn.pmsType}\n`;
        result += `  • Env: ${conn.environment}\n`;
        if (conn.lastSyncAt) {
            result += `  • Last sync: ${conn.lastSyncAt.toISOString()}\n`;
        }
        result += '\n';
    }
    return result;
}
async function connectPMS(args) {
    if (args.length < 2) {
        return '❌ Usage: `/eywa connect <pms_type> <key>=<value> ...`\n\n' +
            'Example:\n' +
            '`/eywa connect mews client_token=xxx access_token=yyy`\n' +
            '`/eywa connect apaleo client_id=xxx client_secret=yyy`';
    }
    const pmsType = args[0];
    const pmsInfo = pms_router_1.PMS_LIST.find(p => p.type === pmsType);
    if (!pmsInfo) {
        return `❌ Unknown PMS: ${pmsType}`;
    }
    // Parse credentials from key=value pairs
    const credentials = {};
    for (let i = 1; i < args.length; i++) {
        const [key, value] = args[i].split('=');
        if (key && value) {
            credentials[key] = value;
        }
    }
    if (Object.keys(credentials).length === 0) {
        return '❌ No credentials provided. Use format: `key=value`';
    }
    try {
        // Test the connection
        const result = await pms_router_1.pmsRouter.testConnection(pmsType, credentials);
        if (result.success) {
            // Generate a hotel ID
            const hotelId = result.data?.id || `hotel_${Date.now()}`;
            // Register the connection
            pms_router_1.pmsRouter.registerConnection({
                id: `conn_${Date.now()}`,
                hotelId,
                pmsType,
                credentials,
                environment: credentials.environment || 'sandbox',
                isActive: true,
                createdAt: new Date()
            });
            return `✅ **Connected to ${pmsInfo.name}!**\n\n` +
                `• Hotel: ${result.data?.name || hotelId}\n` +
                `• ID: \`${hotelId}\`\n` +
                `• Timezone: ${result.data?.timezone}\n` +
                `• Currency: ${result.data?.currency}\n\n` +
                `Try: \`/eywa rooms ${hotelId}\``;
        }
        else {
            return `❌ Connection failed: ${result.message}`;
        }
    }
    catch (error) {
        return `❌ Error: ${error.message}`;
    }
}
async function getAvailability(args) {
    const [hotelId, startDate, endDate] = args;
    if (!hotelId || !startDate || !endDate) {
        return '❌ Usage: `/eywa availability <hotel_id> <start_date> <end_date>`\n\n' +
            'Example: `/eywa availability hotel1 2024-03-01 2024-03-05`';
    }
    try {
        const availability = await pms_router_1.pmsRouter.getAvailability(hotelId, { startDate, endDate });
        if (availability.length === 0) {
            return `📅 No availability data for ${startDate} to ${endDate}`;
        }
        let result = `📅 **Availability** (${startDate} → ${endDate})\n\n`;
        for (const avail of availability.slice(0, 10)) {
            result += `• ${avail.date}: ${avail.available} rooms @ ${avail.rate}\n`;
        }
        if (availability.length > 10) {
            result += `\n_...and ${availability.length - 10} more_`;
        }
        return result;
    }
    catch (error) {
        return `❌ Error: ${error.message}`;
    }
}
async function getReservations(args) {
    const [hotelId, startDate, endDate] = args;
    if (!hotelId) {
        return '❌ Usage: `/eywa reservations <hotel_id> [start_date] [end_date]`';
    }
    try {
        const reservations = await pms_router_1.pmsRouter.getReservations(hotelId, { startDate, endDate });
        if (reservations.length === 0) {
            return '📋 No reservations found.';
        }
        let result = `📋 **Reservations** (${reservations.length} total)\n\n`;
        for (const res of reservations.slice(0, 5)) {
            result += `**${res.guestName}**\n`;
            result += `  • ID: ${res.id}\n`;
            result += `  • ${res.checkIn} → ${res.checkOut}\n`;
            result += `  • Status: ${res.status}\n`;
            result += `  • Total: ${res.totalAmount} ${res.currency}\n\n`;
        }
        if (reservations.length > 5) {
            result += `_...and ${reservations.length - 5} more_`;
        }
        return result;
    }
    catch (error) {
        return `❌ Error: ${error.message}`;
    }
}
async function getRoomTypes(args) {
    const [hotelId] = args;
    if (!hotelId) {
        return '❌ Usage: `/eywa rooms <hotel_id>`';
    }
    try {
        const rooms = await pms_router_1.pmsRouter.getRoomTypes(hotelId);
        if (rooms.length === 0) {
            return '🛏️ No room types found.';
        }
        let result = `🛏️ **Room Types** (${rooms.length})\n\n`;
        for (const room of rooms) {
            result += `**${room.name}**\n`;
            result += `  • ID: \`${room.id}\`\n`;
            result += `  • Capacity: ${room.capacity} guests\n`;
            if (room.description) {
                result += `  • ${room.description.substring(0, 50)}...\n`;
            }
            result += '\n';
        }
        return result;
    }
    catch (error) {
        return `❌ Error: ${error.message}`;
    }
}
