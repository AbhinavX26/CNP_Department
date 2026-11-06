export const REQUEST_TIMEOUT_MS = 8_000;

export function requestTimeout(timeoutMs = REQUEST_TIMEOUT_MS) {
  return (_req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          message: 'The server took too long to respond',
        });
      }
    }, timeoutMs);

    res.once('finish', () => clearTimeout(timer));
    res.once('close', () => clearTimeout(timer));
    next();
  };
}
