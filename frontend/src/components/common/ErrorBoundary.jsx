import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
          <div className="bg-white rounded-xl shadow-lifted p-8 max-w-sm w-full text-center">
            <AlertTriangle
              className="w-10 h-10 text-error mx-auto mb-4"
              aria-hidden="true"
            />
            <h1 className="font-display text-stone-900 text-xl mb-2">
              Something went wrong
            </h1>
            <p className="text-stone-500 font-body text-sm mb-6 leading-relaxed">
              An unexpected error occurred. Please refresh the page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-coral-400 hover:bg-coral-500 active:bg-coral-600 text-white font-body font-semibold px-6 py-2.5 rounded-lg transition-colors shadow-coral focus:outline-none focus:ring-2 focus:ring-coral-300"
              aria-label="Reload page"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
