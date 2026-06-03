export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Send email via Resend (free tier: 3000 emails/month)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Top Cheese Hockey <noreply@topcheesehockey.com>',
      to: 'colinzappia@gmail.com',
      subject: `Contact Form: ${name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
      reply_to: email,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Resend error:', error);
    return res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }

  return res.status(200).json({ success: true });
}
