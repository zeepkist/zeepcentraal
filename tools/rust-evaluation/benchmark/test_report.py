import unittest
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from report import memory, percentile


class ReportTests(unittest.TestCase):
    def test_percentile_interpolates(self):
        self.assertAlmostEqual(percentile([40, 10, 30, 20], .95), 38.5)

    def test_phase_excludes_other_windows_and_converts_units(self):
        rows = [{
            'unixSeconds': i, 'pssKiB': 1024 * (i + 1), 'rssKiB': 2048,
            'workingSetBytes': 3145728, 'cgroupBytes': 4194304,
            'cpu': {'usage_usec': i * 500000}, 'processes': [{}, {}],
            'swapBytes': 0, 'memoryEvents': {'limitHits': 0},
        } for i in range(10)]
        result = memory(rows, 2, 4)
        self.assertEqual(result['samples'], 3)
        self.assertEqual(result['pssMedianMiB'], 4)
        self.assertEqual(result['cpuCores'], .5)
        self.assertEqual(result['workingSetMedianMiB'], 3)
        self.assertEqual(result['processCountMax'], 2)

    def test_missing_samples_fail_instead_of_reporting_zero(self):
        with self.assertRaises(ValueError):
            memory([], 0, 10)

    def test_all_rejected_attempts_remain_visible_without_claiming_zero_memory(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            attempt = root / '1-diesel'
            attempt.mkdir()
            (attempt / 'failed.json').write_text(json.dumps({
                'variant': 'diesel', 'round': 1, 'reason': 'Invalid burst',
            }))
            (attempt / 'burst.json').write_text(json.dumps({'errors': 0, 'dropped': 13}))
            subprocess.run([sys.executable, str(Path(__file__).with_name('report.py')), directory],
                           check=True, capture_output=True)
            report = json.loads((root / 'report.json').read_text())
            self.assertEqual(report['summary'], [])
            self.assertEqual(report['variantsWithoutValidTrials'], ['diesel'])
            self.assertEqual(len(report['rejectedAttempts']), 1)
            markdown = (root / 'report.md').read_text()
            self.assertIn('| diesel | 0/1 | — |', markdown)
            self.assertIn('13 dropped arrivals', markdown)


if __name__ == '__main__':
    unittest.main()
