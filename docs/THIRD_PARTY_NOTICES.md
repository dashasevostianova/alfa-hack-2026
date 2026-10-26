# Сторонние данные
В нашем решении мы использовали несколько сторонних источников, а именно датасет для обучения модели, сайт Альфа Банка для выгрузки актуальных кредитных ставок и Российскую базу бухгалтерской отчетности.

## Датасет для обучения модели
Оригинальный датасет взят из [https://github.com/shoumyac/sme-credit-risk-capital-pricing/blob/main/data/bangladesh_sme_1200_records.csv](https://github.com/shoumyac/sme-credit-risk-capital-pricing/blob/main/data/bangladesh_sme_1200_records.csv)
И храниться в [bangladesh_sme_1200_records_approved.csv](https://github.com/dashasevostianova/alfa-hack-2026/model/bangladesh_sme_1200_records_approved.csv)
Проверяется с помощью [Dataset_check.ipynb](https://github.com/dashasevostianova/alfa-hack-2026/blob/documentation/model/Dataset_check.ipynb)

Использовался для оценки заявки и получения статуса (одобрено или не одобрено)

## Сайт Альфа банка
Сайт с калькулятором от Альфа Банка использовался нами для получения актуальных ставок по кредитам, а так же для получения актуальных предложений.
Сайт: [alfabank.ru](https://alfabank.ru/get-money/credit/credit-cash/onlajn-zayavka/?platformId=yandex_cpc_yxprptr_yandex_cn_core_search_brand_dyn_rf%7C205663716800_205663716800%7Ccid%7C704111139%7Cgid%7C5663716800%7Caid%7C17352369445%7Caud%7C37449068%7Cadp%7Cno%7Cpos%7Cdynamic_places1%7Csrc%7Csearch_yandex.ru%7Cdvc%7Cdesktop%7Creg40_Приволжский%20федеральный%20округ&utm_campaign=yxprptr_yandex_cn_core_search_brand_dyn_rf&utm_content=campaign_name_yxprptr_yandex_cn_core_search_brand_dyn_rf%7Ccampaign_id_704111139%7Cgbid_5663716800%7Cad_id_17352369445%7Ccampaign_name_lat_yxprptr_yandex_cn_core_search_brand_dyn_rf%7Ccoef_goal_context_id_37449068%7Ckeyword_---autotargeting%7Cphrase_id_205663716800%7Cretargeting_id_205663716800%7Cposition_1%7Cposition_type_dynamic_places%7Csource_yandex.ru%7Csource_type_search%7Cdevice_type_desktop%7Cregion_id_40%7Cregion_name_Приволжский%20федеральный%20округ&utm_medium=cpc&utm_source=yandex&yclid=15855131718310952959)
Обрабатывается бэкендом в [parser](https://github.com/dashasevostianova/alfa-hack-2026/tree/documentation/parser)

## Российская база бухгалтерской отчетности
Российская база бухгалтерской отчетности использовалась нами следующим образом: Первые 1000 компаний были выгружены в [companies_small.csv](https://github.com/dashasevostianova/alfa-hack-2026/tree/documentation/backend/formation/data/companies_small.csv)
На основе созданной таблице, по ИНН данные о бизнесе дозаполняются и проверяется существование компании.
Сайт: [Российская база бухгалтерской отчетности](https://tochno.st/datasets/rfsd)
