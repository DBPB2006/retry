import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { formatDate, formatCurrency } from '../utils/formatters';

export default function ExplorePage() {
  const [categories, setCategories] = useState([]);
  const [listings, setListings] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all'); // 'all', 'direct', 'resale'
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [sortBy, setSortBy] = useState('date_asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    api.getCategories()
      .then((data) => {
        if (active) setCategories(data || []);
      })
      .catch((err) => {
        console.error('Failed to load categories', err);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    api.getListings({
      category: selectedCategory,
      type: selectedType,
      q: activeSearch,
      sort: sortBy,
    })
      .then((data) => {
        if (active) {
          setListings(data.listings || []);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Failed to retrieve tickets and listings.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedCategory, selectedType, sortBy, activeSearch]);

  const handleTypeChange = (type) => {
    setSelectedType(type);
    setLoading(true);
  };

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    setLoading(true);
  };

  const handleSortChange = (sort) => {
    setSortBy(sort);
    setLoading(true);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
    setLoading(true);
  };

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSelectedType('all');
    setSearchQuery('');
    setActiveSearch('');
    setLoading(true);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 8px' }}>
      {/* Hero Section */}
      <section style={{ marginBottom: '32px', textAlign: 'center', padding: '24px 0 12px 0' }}>
        <h1 style={{ fontSize: '2.4rem', fontWeight: 800, marginBottom: '10px', letterSpacing: '-0.02em' }}>
          Discover & Book Tickets
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '1.05rem', maxWidth: '640px', margin: '0 auto' }}>
          Explore events, entertainment, and travel options with secure direct booking and peer-to-peer resale.
        </p>
      </section>

      {/* Type Toggle & Category Pills */}
      <section style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Inventory Type Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{
            display: 'inline-flex',
            background: 'var(--color-surface, #f1f5f9)',
            padding: '4px',
            borderRadius: '10px',
            gap: '4px',
            border: '1px solid var(--color-border, #e2e8f0)'
          }}>
            <button
              onClick={() => handleTypeChange('all')}
              className={`btn btn-sm ${selectedType === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ borderRadius: '8px', padding: '6px 16px', fontSize: '0.88rem' }}
            >
              All Inventory
            </button>
            <button
              onClick={() => handleTypeChange('direct')}
              className={`btn btn-sm ${selectedType === 'direct' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ borderRadius: '8px', padding: '6px 16px', fontSize: '0.88rem' }}
            >
              Direct Booking
            </button>
            <button
              onClick={() => handleTypeChange('resale')}
              className={`btn btn-sm ${selectedType === 'resale' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ borderRadius: '8px', padding: '6px 16px', fontSize: '0.88rem' }}
            >
              Verified Resale
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', justifyContent: 'flex-start' }}>
          <button
            onClick={() => handleCategoryChange('all')}
            className={`btn btn-sm ${selectedCategory === 'all' ? 'btn-primary' : 'btn-outline'}`}
            style={{ borderRadius: '20px', whiteSpace: 'nowrap' }}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.slug)}
              className={`btn btn-sm ${selectedCategory === cat.slug ? 'btn-primary' : 'btn-outline'}`}
              style={{ borderRadius: '20px', whiteSpace: 'nowrap' }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Search & Sort Controls */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="input-text"
            placeholder="Search by event, artist, train, flight route, stadium or seat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, minWidth: '240px' }}
          />
          <select
            className="select-input"
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            style={{ width: 'auto', minWidth: '180px' }}
          >
            <option value="date_asc">Event Date: Earliest First</option>
            <option value="date_desc">Event Date: Latest First</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
          <button type="submit" className="btn btn-primary" style={{ padding: '0 20px' }}>
            Search
          </button>
        </form>
      </section>

      {/* Error Banner */}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Content Grid */}
      {loading ? (
        <div className="state-box">
          <p className="state-title">Loading available tickets...</p>
          <p className="state-desc">Fetching live provider inventory and marketplace listings...</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="state-box">
          <p className="state-title">No tickets found</p>
          <p className="state-desc">
            There are currently no tickets matching your category or search filter.
          </p>
          <div style={{ marginTop: '16px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={handleResetFilters}
              className="btn btn-outline btn-sm"
            >
              Reset Filters
            </button>
            <Link to="/sell" className="btn btn-primary btn-sm">
              List a Ticket for Resale
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
          {listings.map((item) => (
            <div
              key={item.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '0',
                overflow: 'hidden',
                borderRadius: '12px',
                transition: 'transform 0.18s ease, box-shadow 0.18s ease',
              }}
            >
              {/* Event Cover Image */}
              {item.image_url ? (
                <div style={{ position: 'relative', height: '160px', width: '100%', overflow: 'hidden' }}>
                  <img
                    src={item.image_url}
                    alt={item.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                  />
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    display: 'flex',
                    gap: '6px'
                  }}>
                    <span className="badge" style={{ background: 'rgba(15, 23, 42, 0.85)', color: '#fff', backdropFilter: 'blur(4px)', textTransform: 'capitalize' }}>
                      {item.category}
                    </span>
                  </div>
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                  }}>
                    {item.is_direct ? (
                      <span className="badge" style={{ background: '#2563eb', color: '#ffffff', fontWeight: 600 }}>
                        Direct Booking
                      </span>
                    ) : (
                      <span className="badge" style={{ background: '#059669', color: '#ffffff', fontWeight: 600 }}>
                        Verified Resale
                      </span>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Card Body */}
              <div style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Provider Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  {item.provider_logo ? (
                    <img
                      src={item.provider_logo}
                      alt={item.provider_name}
                      style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : null}
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                    {item.provider_name}
                  </span>
                </div>

                <h2 style={{ fontSize: '1.18rem', fontWeight: 700, marginBottom: '8px', lineHeight: 1.35 }}>
                  {item.title}
                </h2>

                <div style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                  <div>
                    <strong style={{ color: 'var(--color-text)' }}>Route / Venue:</strong> {item.venue_or_route}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--color-text)' }}>Seat / Detail:</strong> {item.seat_or_coach}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--color-text)' }}>Date & Time:</strong> {formatDate(item.event_date)}
                  </div>
                  {item.seller_username ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>
                      Listed by: @{item.seller_username}
                    </div>
                  ) : null}
                </div>

                {/* Card Footer */}
                <div style={{
                  marginTop: 'auto',
                  paddingTop: '14px',
                  borderTop: '1px solid var(--color-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)' }}>
                      {item.is_direct ? 'Base Price' : `Face Value: ${formatCurrency(item.face_value)}`}
                    </div>
                    <div style={{ fontSize: '1.28rem', fontWeight: 800, color: 'var(--color-primary, #2563eb)' }}>
                      {formatCurrency(item.total_price)}
                    </div>
                  </div>
                  <Link
                    to={`/listings/${item.id}`}
                    className={`btn btn-sm ${item.is_direct ? 'btn-primary' : 'btn-outline'}`}
                  >
                    {item.is_direct ? 'Book Ticket' : 'Buy Resale'}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
