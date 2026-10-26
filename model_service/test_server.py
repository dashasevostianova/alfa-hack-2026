import unittest

from server import FEATURES, predict, validate_features


class FakeScaler:
    def transform(self, values):
        self.values = values
        return values


class FakeModel:
    def __init__(self, prediction):
        self.prediction = prediction

    def predict(self, values):
        return [self.prediction]


class ModelServiceTests(unittest.TestCase):
    def setUp(self):
        self.features = dict.fromkeys(FEATURES, 1)
        self.features.update(
            business_age_years=2.5,
            net_profit=-100,
            purpose=3,
            term_months=24,
        )

    def test_validates_and_preserves_training_feature_order(self):
        values = validate_features(self.features)
        self.assertEqual(values, [2.5, 1, 1, -100, 1, 3, 1, 24])

    def test_predicts_binary_result(self):
        scaler = FakeScaler()
        self.assertEqual(predict(FakeModel(1), scaler, self.features), 1)
        self.assertEqual(scaler.values, [[2.5, 1.0, 1.0, -100.0, 1.0, 3.0, 1.0, 24.0]])
        self.assertEqual(predict(FakeModel(0), scaler, self.features), 0)

    def test_rejects_missing_or_extra_features(self):
        with self.assertRaises(ValueError):
            validate_features({key: value for key, value in self.features.items() if key != 'amount'})
        with self.assertRaises(ValueError):
            validate_features({**self.features, 'okved': 1})

    def test_rejects_invalid_categories_and_non_finite_values(self):
        with self.assertRaises(ValueError):
            validate_features({**self.features, 'legal_form': 2})
        with self.assertRaises(ValueError):
            validate_features({**self.features, 'business_age_years': float('nan')})


if __name__ == '__main__':
    unittest.main()
