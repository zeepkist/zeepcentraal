import unittest
from measure import percentile


class PercentileTests(unittest.TestCase):
    def test_interpolates_small_samples_and_preserves_extremes(self):
        self.assertEqual(percentile([30, 10, 20], .5), 20)
        self.assertEqual(percentile([10, 20], .95), 19.5)
        self.assertEqual(percentile([7], .99), 7)


if __name__ == '__main__':
    unittest.main()
