import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import JobSheetPage from "./JobSheetPage";

const JobSheetEditWrapper = () => {
  const { id } = useParams();
  const [editData, setEditData] = useState(null);
  const [loading, setLoading] = useState(true);
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios.get(`${API}/api/jobsheets/${id}`)
      .then(res => {
        setEditData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="text-center mt-5">Loading...</div>;
  if (!editData) return <div className="text-center mt-5 text-danger">Job Sheet Not Found ❌</div>;

  return <JobSheetPage isEdit={true} editData={editData} />;
};

export default JobSheetEditWrapper;