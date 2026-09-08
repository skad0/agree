-- Campaign SQL files may embed CRLF inside multi-line template string literals on Windows checkouts.
-- Share and mailto URLs are cleaner with LF-only bodies.
UPDATE message_templates
  SET body = replace(body, char(13), ''),
      subject = CASE WHEN subject IS NULL THEN NULL ELSE replace(subject, char(13), '') END;
