const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require("http");
const host = 'localhost';
const port = 8000;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'db',
    password: 'postgres',
    port: 5432,
})

function generateHeaders(allowMethods, allowHeaders) {
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': allowMethods,
        'Access-Control-Allow-Headers': allowHeaders
    }
}

const login = async (req, res) => {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', async () => {
        const parsedBody = JSON.parse(body);
        const { username, password } = parsedBody;

        try {
            const userQuery = 'SELECT * FROM users WHERE username = $1';
            const userResult = await pool.query(userQuery, [username]);

            if (userResult.rows.length === 0) {
                res.writeHead(401, generateHeaders('GET, POST', 'X-Requested-With,content-type'));
                res.end(JSON.stringify({ message: 'Invalid username or password' }));
                return;
            }

            const user = userResult.rows[0];
            const isPasswordMatch = bcrypt.compareSync(password, user.password_hash);

            if (!isPasswordMatch) {
                res.writeHead(401, generateHeaders('GET, POST', 'X-Requested-With,content-type'));
                res.end(JSON.stringify({ message: 'Invalid username or password' }));
                return;
            }

            const token = jwt.sign({ username }, 'ITMO', { expiresIn: '1h' });

            res.writeHead(200, generateHeaders('GET, POST', 'X-Requested-With,content-type'));
            res.end(token);
        } catch (error) {
            res.writeHead(500, generateHeaders('GET, POST', 'X-Requested-With,content-type'));
            res.end(JSON.stringify({ message: 'Server error' }));
        }
    });
};

const register = async (req, res) => {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', async () => {
        const parsedBody = JSON.parse(body);
        const { superuserName, superuserPassword, newUserUsername, newUserPassword, isNewUserSuper } = parsedBody;

        try {
            const query = 'SELECT * FROM users WHERE username = $1';
            const result = await pool.query(query, [superuserName]);

            if (result.rows.length === 0 ||
                !bcrypt.compareSync(superuserPassword, result.rows[0].password_hash) ||
                !result.rows[0].is_superuser) {
                    res.writeHead(401, generateHeaders('POST', 'X-Requested-With,content-type'));
                    res.end(JSON.stringify({ message: 'Superuser authentication failed, ' + result.rows[0].is_superuser }));
                    return;
            }

            const insertQuery = 'INSERT INTO users (username, password_hash, is_superuser) VALUES ($1, $2, $3)';
            await pool.query(insertQuery, [newUserUsername, bcrypt.hashSync(newUserPassword, 10), isNewUserSuper]);

            res.writeHead(201, generateHeaders('POST', 'X-Requested-With,content-type'));
            res.end(JSON.stringify({ message: 'New user registered successfully' }));
        } catch (error) {
            res.writeHead(409, generateHeaders('POST', 'X-Requested-With,content-type'));
            res.end(JSON.stringify({ message: error.message }));
        }
    });
};

const extractTopology = async () => {
    try {
        const devicesQuery = 'SELECT * FROM devices_table';
        const devicesResult = await pool.query(devicesQuery);

        const linksQuery = 'SELECT * FROM links_table';
        const linksResult = await pool.query(linksQuery);

        const nodes = devicesResult.rows.map(device => ({
            databaseId: device.id,
            id: device.hostname,
            hostname: device.hostname,
            name: device.name,
            mac: device.mac,
            type: device.type,
            isRoot: device.is_root,
            rootIfaceDesc: device.root_iface_desc,
            label: device.hostname,
            location: device.location,
            note: device.note,
            x: device.x,
            y: device.y
        }));

        const edges = linksResult.rows.map(link => ({
            from: link.hostname1,
            to: link.hostname2,
            databaseId: link.id,
            label: ``,
            hostname1: link.hostname1,
            hostname2: link.hostname2,
            mac1: link.mac1,
            mac2: link.mac2,
            iface1: link.iface1,
            iface2: link.iface2,
        }));

        const combinedData = {
            nodes: nodes,
            edges: edges,
        };

        return JSON.stringify(combinedData);
    } catch (error) {
        console.error('Error combining data: ', error);
    }
};

const getIfaces = async (hostname) => {
    try {
        const ifacesQuery = `SELECT * FROM ifaces_table WHERE hostname='${hostname}';`;
        const ifacesResult = await pool.query(ifacesQuery);

        const ifaces = ifacesResult.rows.map(iface => ({
            databaseId: iface.id,
            name: iface.name,
            description: iface.description,
            type: iface.type,
            role: iface.role,
            ifaceStatus: iface.iface_status,
            hostname: iface.hostname
        }));

        return JSON.stringify(ifaces, null, 2);
    } catch (error) {
        console.error('Error extracting ifaces: ', error);
    }
}

const saveTopology = async (req, res) => {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', async () => {
        try {
            const parsedBody = JSON.parse(body);
            const { nodes, edges } = parsedBody;

            await pool.query('BEGIN');

            await pool.query('DELETE FROM devices_table');
            await pool.query('DELETE FROM links_table');

            const insertDevicesQuery = `
                INSERT INTO devices_table (hostname, name, mac, type, is_root, root_iface_desc, location, note, x, y)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id;`;

            for (const node of nodes) {
                const { rows: [insertedNode] } = await pool.query(insertDevicesQuery, [
                    node.hostname,
                    node.name,
                    node.mac,
                    node.type,
                    node.isRoot,
                    node.rootIfaceDesc,
                    node.location || '',
                    node.note || '',
                    node.x || 0,
                    node.y || 0
                ]);

                node.databaseId = insertedNode.id;
            }


            const insertLinksQuery = `
                INSERT INTO links_table (hostname1, hostname2, mac1, mac2, iface1, iface2)
                VALUES ($1, $2, $3, $4, $5, $6);`;

            for (const edge of edges) {
                await pool.query(insertLinksQuery, [
                    edge.hostname1,
                    edge.hostname2,
                    edge.mac1,
                    edge.mac2,
                    edge.iface1,
                    edge.iface2
                ]);
            }

            // Завершаем транзакцию
            await pool.query('COMMIT');

            res.writeHead(200, generateHeaders('POST', 'X-Requested-With,content-type'));
            res.end(JSON.stringify({ message: 'Topology saved successfully.' }));
        } catch (error) {
            // Откатываем транзакцию в случае ошибки
            await pool.query('ROLLBACK');

            res.writeHead(500, generateHeaders('POST', 'X-Requested-With,content-type'));
            res.end(JSON.stringify({ message: 'Failed to save topology: ' + error.message }));
        }
    });
};


const requestListener = async function (req, res) {
    if (req.method === 'OPTIONS') {
        res.writeHead(200, generateHeaders('GET, POST, OPTIONS, PUT, PATCH, DELETE', 'X-Requested-With, content-type, Authorization'));
        res.end();
        return;
    }

    if (req.url === '/login' && req.method === 'POST') {
        await login(req, res);
        return;
    }

    if (req.url === '/register' && req.method === 'POST') {
        await register(req, res);
        return;
    }

    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.writeHead(401, generateHeaders('GET, POST', 'X-Requested-With,content-type'));
        res.end(JSON.stringify({ message: 'Unauthorized' }));
        return;
    }

    try {
        req.user = jwt.verify(token, 'ITMO');
    } catch (err) {
        res.writeHead(401, generateHeaders('GET, POST', 'X-Requested-With,content-type'));
        res.end(JSON.stringify({ message: 'Invalid token' }));
        return;
    }

    if (req.url === '/get-topology' && req.method === 'GET') {
        const data = await extractTopology();
        res.writeHead(200, generateHeaders('GET, POST', 'X-Requested-With,content-type'));
        res.end(data);
    } else if (req.url === '/save-topology' && req.method === 'POST') {
        await saveTopology(req, res);
    } else if (req.url.startsWith('/ifaces/') && req.method === 'GET') {
        const hostname = req.url.substring(8);
        const data = await getIfaces(hostname);
        res.writeHead(200, generateHeaders('GET, POST, OPTIONS', 'X-Requested-With, content-type, Authorization'));
        res.end(data);
    } else {
        res.writeHead(404, generateHeaders('GET, POST', 'X-Requested-With,content-type'));
        res.end(JSON.stringify({message: 'Not found'}));
    }
};


const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
})