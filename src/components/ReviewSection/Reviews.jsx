import React, { useState, useEffect } from "react";
import "./Reviews.css";
import NotificationModal from "../NotificationModal/NotificationModal";

const defaultConfig = {
  section_label: "User Insights",
  section_title: "Trusted by Students and Educators Nationwide",
  section_description:
    "Real feedback from learners and instructors using NextEd AI's integrated platform for AI-powered study assistance, voice-based tutoring, automated assessments, and intelligent classroom management.",
  form_title: "Share Your Experience",
  name_label: "Full Name",
  email_label: "Email Address",
  review_label: "Your Feedback",
  rating_label: "Rate Your Experience",
  submit_button_text: "Submit Feedback",
  empty_state_text:
    "No feedback submitted yet. Be the first to share your experience with NextEd AI.",
};

function Reviews() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    review: "",
    rating: 0,
  });
  const [hoverRating, setHoverRating] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [filterRating, setFilterRating] = useState(0); // 0 means all reviews
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/reviews");
      const data = await response.json();
      if (data.success) {
        setReviews(data.data);
      }
    } catch (error) {
      console.error("Error loading reviews:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.review.trim() || formData.rating === 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("http://localhost:5000/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          reviewText: formData.review.trim(),
          rating: formData.rating,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setReviews([data.data, ...reviews]);
        
        setFormData({
          name: "",
          email: "",
          review: "",
          rating: 0,
        });

        setIsError(false);
        setToastMessage("Feedback submitted successfully");
        setShowToast(true);
      } else {
        setIsError(true);
        setToastMessage(data.message || "Failed to submit feedback");
        setShowToast(true);
      }
    } catch (error) {
      console.error("Error saving review:", error);
      setIsError(true);
      setToastMessage("Network error. Please try again later.");
      setShowToast(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const renderStars = (count) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i}>{i < count ? "★" : "☆"}</span>
    ));
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const options = { year: "numeric", month: "long", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  const isFormValid =
    formData.name.trim() && formData.email.trim() && formData.review.trim() && formData.rating > 0;

  const filteredReviews = filterRating === 0 
    ? reviews 
    : reviews.filter(review => review.rating === filterRating);

  return (
    <div className="review-section-wrapper">
      <NotificationModal 
        isOpen={showToast} 
        onClose={() => setShowToast(false)} 
        title={isError ? "Error" : "Success"} 
        message={toastMessage} 
        type={isError ? "error" : "success"} 
      />

      <div className="review-container">
        <header className="section-header">
          <div className="section-label section-label--highlighted">
            {defaultConfig.section_label}
          </div>
          <h1 className="reviews-title">{defaultConfig.section_title}</h1>
          <p className="section-description">
            {defaultConfig.section_description}
          </p>
        </header>

        <div className="form-card">
          <h2 className="form-title">{defaultConfig.form_title}</h2>
          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name" className="field-label">
                <svg className="label-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>{defaultConfig.name_label}</span>
              </label>
              <input
                type="text"
                id="name"
                className="input-field"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email" className="field-label">
                <svg className="label-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>{defaultConfig.email_label}</span>
              </label>
              <input
                type="email"
                id="email"
                className="input-field"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="your.email@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="review" className="field-label">
                <svg className="label-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span>{defaultConfig.review_label}</span>
              </label>
              <textarea
                id="review"
                className="input-field textarea-field"
                value={formData.review}
                onChange={(e) => handleInputChange("review", e.target.value)}
                placeholder="Share your experience with NextEd AI's learning platform..."
                required
              />
            </div>

            <div className="form-group">
              <label className="field-label">
                <svg className="label-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <span>{defaultConfig.rating_label}</span>
              </label>
              <div className="star-rating-container">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`star-button ${star <= (hoverRating || formData.rating) ? "filled" : ""}`}
                    onClick={() => handleInputChange("rating", star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`Rate ${star} stars`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="gradient-button"
              disabled={!isFormValid || isSubmitting}
            >
              <span>{isSubmitting ? "Submitting..." : defaultConfig.submit_button_text}</span>
            </button>
          </form>
        </div>

        {/* Filter Selection UI */}
        {reviews.length > 0 && (
          <div className="rating-filter-container">
            <span className="filter-label">Filter by Rating:</span>
            <div className="filter-pills">
              <button 
                className={`filter-pill ${filterRating === 0 ? 'active' : ''}`} 
                onClick={() => setFilterRating(0)}
              >
                All
              </button>
              {[5, 4, 3, 2, 1].map(star => (
                <button 
                  key={star}
                  className={`filter-pill ${filterRating === star ? 'active' : ''}`} 
                  onClick={() => setFilterRating(star)}
                >
                  {star} ★
                </button>
              ))}
            </div>
          </div>
        )}

        {filteredReviews.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <h3 className="empty-title">
             {filterRating === 0 ? "No Feedback Yet" : `No ${filterRating}-Star Reviews`}
            </h3>
            <p className="empty-text">
              {filterRating === 0 
                ? defaultConfig.empty_state_text 
                : "Try selecting a different rating filter or be the first to leave one!"}
            </p>
          </div>
        ) : (
          <div className="reviews-grid">
            {filteredReviews.map((review, index) => (
              <article
                key={review._id || index}
                className="review-card"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="review-header">
                  <div className="reviewer-info">
                    <h3 className="reviewer-name">{review.name}</h3>
                    <time className="review-date">
                      {formatDate(review.createdAt || Date.now())}
                    </time>
                  </div>
                  <div
                    className="review-rating"
                    aria-label={`${review.rating} out of 5 stars`}
                  >
                    {renderStars(review.rating)}
                  </div>
                </div>
                <p className="review-text">{review.reviewText}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Reviews;
