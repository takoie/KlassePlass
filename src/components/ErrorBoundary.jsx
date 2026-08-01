import React from 'react';

/**
 * Fanger opp uventede render-feil i hele appen slik at brukeren får en
 * gjenkjennelig feilmelding i stedet for en blank, hvit skjerm.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Uventet feil i grensesnittet:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-base-300 text-center p-8 gap-4">
          <i className="fa-solid fa-triangle-exclamation text-5xl text-red-400"></i>
          <h1 className="text-xl font-bold text-white">Noe gikk galt</h1>
          <p className="text-sm text-slate-400 max-w-md">
            KlassePlass støtte på en uventet feil og kunne ikke fortsette å vise dette skjermbildet.
            Ingen data er nødvendigvis tapt — prøv å starte appen på nytt.
          </p>
          <button
            className="btn btn-primary btn-sm gap-2"
            onClick={() => window.location.reload()}
          >
            <i className="fa-solid fa-rotate-right"></i> Start på nytt
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
