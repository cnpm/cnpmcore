DROP INDEX IF EXISTS idx_category_parent;

CREATE INDEX idx_category_parent_gmt_create ON binaries (category, parent, gmt_create);
