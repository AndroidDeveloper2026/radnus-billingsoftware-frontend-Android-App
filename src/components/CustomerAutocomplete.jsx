import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

const CustomerAutocomplete = ({ 
  type,
  value,
  onChange,
  onSelect,
  placeholder,
  maxLength,
  className = "",
  inputProps = {},
  filterNumbers = false,
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions when typing
  useEffect(() => {
    if (!value || value.trim().length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        console.log(`🔍 Searching: q=${value}, type=${type}`);
        const res = await axios.get(`${API}/api/jobsheets/customers/search`, {
          params: { q: value, type }
        });
        console.log(`✅ Results:`, res.data);
        setSuggestions(res.data);
        setShowSuggestions(res.data.length > 0);
      } catch (err) {
        console.error("❌ Customer search error:", err.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [value, type]);

  const handleInputChange = (e) => {
    let val = e.target.value;
    if (filterNumbers) {
      val = val.replace(/\D/g, "");
    }
    onChange(val);
    setShowSuggestions(true);
  };

//   const handleBlur = (e) => {
//     // Call parent's onBlur if provided
//     if (inputProps.onBlur) {
//       inputProps.onBlur(e);
//     }
//   };

const handleBlur = (e) => {
  if (inputProps.onBlur) {
    // Create a synthetic event-like object with current value
    const syntheticEvent = {
      ...e,
      target: {
        ...e.target,
        value: value  // ← use the prop value, not DOM value
      }
    };
    inputProps.onBlur(syntheticEvent);
  }
};

  const handleSelect = (customer) => {
    onSelect(customer);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <input
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onBlur={handleBlur}
        maxLength={maxLength}
        autoComplete="off"
      />
      
      {loading && (
        <div style={{
          position: "absolute",
          right: "10px",
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: "10px",
          color: "#666"
        }}>
          ⏳
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
  <div style={{
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    zIndex: 9999,
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "6px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    maxHeight: "250px",
    overflowY: "auto",
    marginTop: "2px"
  }}>
    {suggestions.map((customer, idx) => (
      <div
        key={idx}
        onClick={() => handleSelect(customer)}
        style={{
          padding: "10px 12px",
          cursor: "pointer",
          borderBottom: idx < suggestions.length - 1 ? "1px solid #f0f0f0" : "none",
          transition: "background 0.2s",
          fontSize: "13px"
        }}
        onMouseEnter={(e) => e.target.style.background = "#f8f9fa"}
        onMouseLeave={(e) => e.target.style.background = "#fff"}
      >
        {/* Name */}
        <div style={{ fontWeight: 600, color: "#1a1a1a" }}>
          {customer.name}
        </div>

        {/* Contact ONLY - NO BADGE */}
        <div style={{ color: "#666", fontSize: "12px", marginTop: "2px" }}>
          📞 {customer.contact}
        </div>
        
        {customer.address && (
          <div style={{ color: "#999", fontSize: "11px", marginTop: "2px" }}>
            📍 {customer.address}
          </div>
        )}
      </div>
    ))}
  </div>
)}
    </div>
  );
};

export default CustomerAutocomplete;