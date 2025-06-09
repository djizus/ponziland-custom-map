import React, { Component, ReactNode } from 'react';
import { logError } from '../utils/errorHandler';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  context?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const context = this.props.context || 'REACT_ERROR_BOUNDARY';
    
    logError(context, error, {
      component: errorInfo.componentStack || 'unknown',
      errorBoundary: true,
      metadata: {
        errorInfo: errorInfo.componentStack || 'no stack available'
      }
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: '20px',
          border: '1px solid #ff6b6b',
          borderRadius: '8px',
          backgroundColor: 'rgba(255, 107, 107, 0.1)',
          color: '#ff6b6b',
          margin: '10px',
          textAlign: 'center'
        }}>
          <h3>Something went wrong</h3>
          <p>An error occurred while rendering this component.</p>
          <details style={{ marginTop: '10px', textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
              Error Details
            </summary>
            <pre style={{ 
              fontSize: '12px', 
              overflow: 'auto', 
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
              padding: '10px',
              borderRadius: '4px'
            }}>
              {this.state.error?.message}
              {this.state.error?.stack}
            </pre>
          </details>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#ff6b6b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Functional component wrapper for easier usage

export const withErrorBoundary = (
  WrappedComponent: React.ComponentType<any>,
  context?: string
) => {
  const WithErrorBoundaryComponent = (props: any) => (
    <ErrorBoundary context={context || WrappedComponent.displayName || WrappedComponent.name}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );
  
  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithErrorBoundaryComponent;
};

export default ErrorBoundary;