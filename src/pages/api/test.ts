import { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Test API called with method:', req.method)

  res.status(200).json({
    success: true,
    message: 'API route is working',
    method: req.method,
    timestamp: new Date().toISOString(),
    env: {
      authEnabled: process.env.NEXT_PUBLIC_AUTH_ENABLED,
      hasClientSecret: !!process.env.NEXT_PUBLIC_OIDC_CLIENT_SECRET
    }
  })
}
