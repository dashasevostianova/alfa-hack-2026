import json
import math
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


FEATURES = (
    'business_age_years',
    'legal_form',
    'revenue',
    'net_profit',
    'current_loans',
    'purpose',
    'amount',
    'term_months',
)


def validate_features(payload):
    if not isinstance(payload, dict) or set(payload) != set(FEATURES):
        raise ValueError('Expected exactly the model feature fields.')

    values = []
    for name in FEATURES:
        value = payload[name]
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f'{name} must be a finite number.')
        try:
            number = float(value)
        except (OverflowError, ValueError) as error:
            raise ValueError(f'{name} must be a finite number.') from error
        if not math.isfinite(number):
            raise ValueError(f'{name} must be a finite number.')
        values.append(number)

    features = dict(zip(FEATURES, values))
    if features['business_age_years'] < 0 or features['revenue'] < 0:
        raise ValueError('Business age and revenue cannot be negative.')
    if features['amount'] <= 0 or features['term_months'] <= 0:
        raise ValueError('Amount and term must be positive.')
    if features['legal_form'] not in (0, 1):
        raise ValueError('legal_form must be 0 (ИП) or 1 (ООО).')
    if features['current_loans'] not in (0, 1):
        raise ValueError('current_loans must be 0 or 1.')
    if features['purpose'] not in (0, 1, 2, 3):
        raise ValueError('purpose must be between 0 and 3.')
    if not features['term_months'].is_integer():
        raise ValueError('term_months must be an integer.')

    return values


def predict(model, scaler, payload):
    values = validate_features(payload)
    prediction = int(model.predict(scaler.transform([values]))[0])
    if prediction not in (0, 1):
        raise RuntimeError('The model returned an invalid prediction.')
    return prediction


class ModelHandler(BaseHTTPRequestHandler):
    model = None
    scaler = None

    def do_GET(self):
        if self.path == '/health':
            return self.respond(200, {'status': 'ok'})
        self.respond(404, {'message': 'Route not found.'})

    def do_POST(self):
        if self.path != '/predict':
            return self.respond(404, {'message': 'Route not found.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > 16384:
                return self.respond(400, {'message': 'Invalid request size.'})
            payload = json.loads(self.rfile.read(length))
            prediction = predict(self.model, self.scaler, payload)
            self.respond(200, {'prediction': prediction})
        except (json.JSONDecodeError, ValueError) as error:
            self.respond(400, {'message': str(error)})

    def respond(self, status, body):
        encoded = json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def main():
    import joblib

    model_dir = Path(os.environ.get('MODEL_DIR', Path(__file__).parent.parent / 'model'))
    ModelHandler.model = joblib.load(model_dir / 'logistic_model.pkl')
    ModelHandler.scaler = joblib.load(model_dir / 'scaler.pkl')
    if getattr(ModelHandler.model, 'n_features_in_', None) != len(FEATURES):
        raise RuntimeError('The saved model does not accept the expected eight features.')
    if getattr(ModelHandler.scaler, 'n_features_in_', None) != len(FEATURES):
        raise RuntimeError('The saved scaler does not accept the expected eight features.')

    host = os.environ.get('MODEL_HOST', '127.0.0.1')
    port = int(os.environ.get('MODEL_PORT', '8082'))
    ThreadingHTTPServer((host, port), ModelHandler).serve_forever()


if __name__ == '__main__':
    main()
