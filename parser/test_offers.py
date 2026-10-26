import unittest
from offers import age_bucket, parse_offer_card


class OfferTests(unittest.TestCase):
    def test_age_is_company_age_and_ip_has_three_month_boundary(self):
        self.assertEqual(age_bucket('OOO', 9), 'До 9 месяцев')
        self.assertEqual(age_bucket('OOO', 10), 'Более 9 месяцев')
        self.assertEqual(age_bucket('IP', 3), 'До 3 месяцев')
        self.assertEqual(age_bucket('IP', 4), 'Более 3 месяцев')
        self.assertEqual(age_bucket('IP', 0), 'До 3 месяцев')
        with self.assertRaises(ValueError):
            age_bucket('OTHER', 2)

    def test_named_offers_keep_different_rates(self):
        credit = parse_offer_card('Кредит для бизнеса без залога\nНа развитие бизнеса\nСтавка\n19%\nУзнать подробнее\nЗаполнить заявку')
        overdraft = parse_offer_card('Овердрафт\nСтавка\n13%\nУзнать подробнее\nЗаполнить заявку')
        self.assertEqual(credit['annualRate'], 19)
        self.assertEqual(overdraft['annualRate'], 13)
        self.assertNotEqual(credit['id'], overdraft['id'])

    def test_monthly_overpayment_and_grace_period_are_not_annual_rates(self):
        seller = parse_offer_card('Альфа-Селлер Кредит\nСтавка\n1,2%\nУзнать подробнее', 'https://alfabank.ru/sme/profits/creditsellers/')
        self.assertEqual(seller['ratePercent'], 1.2)
        self.assertEqual(seller['rateUnit'], 'monthly_overpayment')
        self.assertIsNone(seller['annualRate'])
        card = parse_offer_card('Кредитная карта\nГрейс-период\nДо 120 дней\nУзнать подробнее')
        self.assertIsNone(card['annualRate'])
        with self.assertRaises(ValueError):
            parse_offer_card('Кредит\nСтавка\nпо договорённости')


if __name__ == '__main__':
    unittest.main()
