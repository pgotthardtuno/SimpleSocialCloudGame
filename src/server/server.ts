// src/server/server.ts
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import helmet from 'helmet';
import authRoutes from './routes/auth';
import { protect, AuthenticatedRequest } from './middleware/authMiddleware';
import 'dotenv/config'; // Ensure dotenv is loaded early if not already in index.ts

const portFromEnv = process.env.PORT ? parseInt(process.env.PORT, 10) : undefined;
export const PORT: number = (portFromEnv !== undefined && !isNaN(portFromEnv)) ? portFromEnv : 3000;

// --- NEW: Read Server Host from Environment Variable ---
// Use '0.0.0.0' as a default to listen on all interfaces if not specified,
// or 'localhost' if you prefer only local access by default.
const SERVER_HOST = process.env.SERVER_HOST || 'localhost';
// ------------------------------------------------------

export function createExpressApp(): express.Application {
    const app: express.Application = express();

    // Use the SERVER_HOST variable read from the environment
    console.log(`Configuring Express app. SERVER_HOST set to: ${SERVER_HOST}`);
    console.log("Configuring Helmet CSP directives..."); // Renamed log for clarity

    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    ...helmet.contentSecurityPolicy.getDefaultDirectives(),

                    // --- CHANGE: Use SERVER_HOST variable ---
                    "form-action": [
                        "'self'", // Allow forms to submit to the same origin
                        `https://${SERVER_HOST}`, // Use the variable (no port needed if behind proxy)
                        // If accessing directly via port 3000 during dev, you might need:
                        // `http://${SERVER_HOST}:${PORT}` // For HTTP dev access
                        // `https://${SERVER_HOST}:${PORT}` // For HTTPS dev access (if applicable)
                    ],

                    // --- CHANGE: Use SERVER_HOST variable ---
                    "connect-src": [
                        "'self'",
                        `wss://${SERVER_HOST}`, // Use wss:// with the variable (no port needed if behind proxy)
                        // For direct dev access:
                        // `ws://localhost:${PORT}`, // Allow ws:// for localhost dev
                        // `wss://localhost:${PORT}`, // Allow wss:// for localhost dev (if applicable)
                        // `ws://${SERVER_HOST}:${PORT}`, // Allow ws:// for specific host dev
                        // `wss://${SERVER_HOST}:${PORT}`, // Allow wss:// for specific host dev (if applicable)
                        "https://unpkg.com", // Keep this if you still load from unpkg
                        // Add any other domains you connect to (e.g., APIs)
                    ],
                    // --- END CHANGES ---

                    "script-src": ["'self'", "https://unpkg.com", "'unsafe-inline'"],
                    "style-src": ["'self'", "'unsafe-inline'"],
                    "img-src": ["'self'", "data:"],
                    "upgrade-insecure-requests": [],
                },
            },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: false
            },
            // Keep other Helmet middleware
        })
    );

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    console.log("Setting up API routes...");
    app.get('/api/ping', (req: Request, res: Response) => {
        res.json({ message: 'pong' });
    });
    app.use('/api/auth', authRoutes);
    app.get('/api/game/data', protect, (req: AuthenticatedRequest, res: Response) => {
        res.json({
            message: `Protected data for ${req.user?.username ?? 'Unknown User'}!`,
            color: req.user?.color ?? '#ffffff'
        });
    });

    console.log("Setting up static file serving...");
    const publicPath = path.join(__dirname, '../../public');
    console.log(`Serving static files from: ${publicPath}`);
    app.use(express.static(publicPath));

    // Serve index.html for the root, and let client-side routing handle others
    // or explicitly define routes for login.html, register.html, game.html if needed.
    app.get(['/', '/index.html', '/login.html', '/register.html', '/game.html'], (req: Request, res: Response) => {
        // Determine the file to send based on the request path
        let filePath = req.path;
        if (filePath === '/') {
            filePath = '/index.html';
        }
        res.sendFile(path.join(publicPath, filePath));
    });


    console.log("Setting up final error handler...");
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        console.error("Unhandled Error:", err.stack || err);
        let statusCode = 500;
        if (err.name === 'UnauthorizedError') {
            statusCode = 401;
        } else if (err.message.includes('Not Found')) {
            statusCode = 404;
        }

        if (!res.headersSent) {
            res.status(statusCode).json({ message: err.message || 'Internal Server Error' });
        } else {
            next(err);
        }
    });

    console.log("Express app configuration complete.");
    return app;
}