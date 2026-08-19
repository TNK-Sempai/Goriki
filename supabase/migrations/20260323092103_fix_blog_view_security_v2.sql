
-- Recréer la vue sans SECURITY DEFINER
DROP VIEW IF EXISTS blog_posts_with_author;

CREATE VIEW blog_posts_with_author AS
SELECT 
  bp.*,
  CONCAT(p.first_name, ' ', p.last_name) as author_name,
  p.avatar_url as author_avatar
FROM blog_posts bp
LEFT JOIN profiles p ON p.id = bp.author_id;
