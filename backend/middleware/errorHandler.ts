export const errorHandler = (
  error: any,
  req: any,
  res: any,
  next: any
) => {
  console.error('Error:', error);

  if (error.message.includes('Invalid or expired token')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (error.message.includes('Authentication required')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (error.message.includes('Owner access required')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';

  res.status(statusCode).json({ error: message });
};