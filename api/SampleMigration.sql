SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";

CREATE TABLE IF NOT EXISTS `alert` (
  `id` bigint(11) unsigned NOT NULL AUTO_INCREMENT,
  `google_email_id` varchar(64) DEFAULT NULL,
  `account_name` varchar(255) DEFAULT NULL,
  `account_number` varchar(15) DEFAULT NULL,
  `amount` decimal(10,0) DEFAULT NULL,
  `created_on` timestamp NULL DEFAULT NULL,
  `remark` text,
  `type` varchar(10) DEFAULT NULL,
  `bank_name` varchar(255) DEFAULT NULL,
  `has_transactions` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=1;
