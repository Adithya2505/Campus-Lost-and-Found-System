-- Tables follow 3NF: categories and users are referenced, not duplicated.
-- Collector name/college ID are an intentional snapshot of an in-person handover.
CREATE TABLE IF NOT EXISTS users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  college_id VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  category_id INT PRIMARY KEY AUTO_INCREMENT,
  category_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS items (
  item_id INT PRIMARY KEY AUTO_INCREMENT,
  category_id INT NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  description VARCHAR(1500) NOT NULL,
  color VARCHAR(50) NOT NULL,
  brand VARCHAR(80) NOT NULL DEFAULT '',
  photo_path VARCHAR(100) NOT NULL,
  found_location VARCHAR(200) NOT NULL,
  found_date DATE NOT NULL,
  submitted_by INT NOT NULL,
  status ENUM('awaiting_deposit','available','collected') NOT NULL DEFAULT 'awaiting_deposit',
  received_by INT NULL,
  received_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE RESTRICT,
  FOREIGN KEY (submitted_by) REFERENCES users(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (received_by) REFERENCES users(user_id) ON DELETE RESTRICT,
  CONSTRAINT chk_receipt CHECK (
    (status = 'awaiting_deposit' AND received_by IS NULL AND received_at IS NULL)
    OR (status IN ('available','collected') AND received_by IS NOT NULL AND received_at IS NOT NULL)
  ),
  INDEX idx_items_status_date (status, created_at)
);

CREATE TABLE IF NOT EXISTS collections (
  collection_id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL UNIQUE,
  claimant_name VARCHAR(100) NOT NULL,
  claimant_college_id VARCHAR(30) NOT NULL,
  handed_over_by INT NOT NULL,
  collected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE RESTRICT,
  FOREIGN KEY (handed_over_by) REFERENCES users(user_id) ON DELETE RESTRICT
);

-- Public projection deliberately excludes finder and claimant identity.
CREATE OR REPLACE VIEW public_items AS
SELECT i.item_id, i.category_id, c.category_name, i.item_name, i.description,
       i.color, i.brand, i.photo_path, i.found_location,
       DATE_FORMAT(i.found_date, '%Y-%m-%d') AS found_date, i.status,
       i.created_at
FROM items i JOIN categories c ON c.category_id = i.category_id
WHERE i.status IN ('available','collected');

DELIMITER $$
DROP TRIGGER IF EXISTS validate_collection$$
CREATE TRIGGER validate_collection BEFORE INSERT ON collections
FOR EACH ROW
BEGIN
  DECLARE current_status VARCHAR(30);
  DECLARE staff_role VARCHAR(10);
  SELECT status INTO current_status FROM items WHERE item_id = NEW.item_id;
  SELECT role INTO staff_role FROM users WHERE user_id = NEW.handed_over_by;
  IF current_status IS NULL OR current_status <> 'available' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item is not available for collection';
  END IF;
  IF staff_role IS NULL OR staff_role <> 'admin' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only security can hand over an item';
  END IF;
END$$

DROP PROCEDURE IF EXISTS collect_item$$
-- This procedure owns its transaction. Do not wrap CALL in another transaction.
CREATE PROCEDURE collect_item(
  IN p_item_id INT, IN p_name VARCHAR(100),
  IN p_college_id VARCHAR(30), IN p_admin_id INT
)
BEGIN
  DECLARE current_status VARCHAR(30);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
  START TRANSACTION;
  -- Serialize concurrent handovers of the same item.
  SELECT status INTO current_status FROM items WHERE item_id = p_item_id FOR UPDATE;
  IF current_status IS NULL OR current_status <> 'available' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item is not available for collection';
  END IF;
  IF CHAR_LENGTH(TRIM(p_name)) = 0 OR CHAR_LENGTH(TRIM(p_college_id)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Claimant details are required';
  END IF;
  INSERT INTO collections (item_id, claimant_name, claimant_college_id, handed_over_by)
  VALUES (p_item_id, TRIM(p_name), TRIM(p_college_id), p_admin_id);
  UPDATE items SET status = 'collected' WHERE item_id = p_item_id;
  COMMIT;
END$$
DELIMITER ;
