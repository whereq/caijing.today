"""caijing.today — Chinese/English finance-news aggregation platform.

Shares the PostgreSQL database and the data collector with flowdesk.top; this
package only implements the read-side API layer that serves the caijing.today
frontend. The news data itself is populated by the (shared) flowdesk collector.
"""
