# Camio - Intelligent Video Surveillance Platform

Camio transforms any device with a camera into an intelligent security system powered by AI. Leverage cutting-edge visual language models for real-time video analysis, receive instant alerts for security events, and access a comprehensive library of recorded footage with detailed analytics.

![Dashboard Preview](/public/dashboard-preview.png)

## 🚀 Features

- **Universal Camera Compatibility**: Turn any device with a camera into a security system
- **Real-time AI Analysis**: Video streams processed by Google's Gemini Visual Language Model
- **Saved Footage Library**: Store and analyze past footage with security insights  
- **Intuitive Dashboard**: Monitor multiple cameras simultaneously
- **Instant Alerts**: Get notified immediately about security or emergency events
- **AI Assistant**: OpenAI-powered contextual support for security questions
- **Cross-Platform**: Works on desktops, tablets, and mobile devices

## 🛠️ Technologies

- **Frontend**: Next.js 15 (App Router) with TypeScript and Tailwind CSS
- **UI Components**: ShadCN UI library for consistent design
- **Authentication & Database**: Supabase for user management and data storage
- **AI Processing**:
  - Google Gemini for video analysis
  - OpenAI for contextual assistant
  - TensorFlow.js for client-side processing
- **Notifications**: Resend API for email alerts

## 📋 Prerequisites

- Node.js 18.x or later
- npm or yarn
- Supabase account
- Google Gemini API key
- OpenAI API key
- Resend API key

## 🔧 Installation

1. Clone this repository
```bash
git clone https://github.com/yourusername/camio.git
cd camio
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Set up environment variables
   - Copy `.env.example` to `.env.local`
   - Fill in the required API keys and configuration values

```bash
cp .env.example .env.local
```

4. Start the development server
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## 📁 Project Structure

```
src/
├── app/                # Next.js App Router pages
│   ├── (auth)/         # Authentication routes (sign-in, sign-up)
│   ├── (dashboard)/    # Dashboard routes (dashboard, cameras)
│   └── api/            # API routes
├── components/         # React components
│   ├── auth/           # Authentication components
│   ├── camera/         # Camera-related components
│   ├── dashboard/      # Dashboard UI components
│   ├── layout/         # Layout components (header, sidebar)
│   └── ui/             # Reusable UI components
└── lib/                # Utility functions and services
    ├── ai/             # AI service integrations (Gemini, OpenAI)
    └── supabase/       # Supabase client configuration
```

## 🔒 Authentication

Camio uses Supabase for authentication. Users can sign up with email/password or sign in with social providers.

## 📹 Camera Registration

Users can register new cameras by providing a name, description, and connection details. The system generates a unique ID for each camera.

## 📊 Dashboard

The dashboard provides a comprehensive view of all registered cameras, with real-time feeds and AI analysis results.

## 🤖 AI Analysis

- **Google Gemini**: Processes video frames to detect objects, people, and unusual activities
- **OpenAI**: Powers the contextual assistant for user queries

## 📱 Responsive Design

The UI is fully responsive and works seamlessly across desktop, tablet, and mobile devices.

## 🧪 Development

This project uses Next.js with Turbopack for fast development and building.

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Lint code
npm run lint
```

## 📄 License

[MIT License](LICENSE)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
