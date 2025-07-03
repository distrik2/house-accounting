"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Card, CardContent, Typography, CircularProgress, Alert, Box } from '@mui/material';

interface DashboardStats {
  total_microdistricts: number;
  total_houses: number;
  total_apartments: number;
  total_residents: number;
  occupied_apartments: number;
}

const StatCard = ({ title, value, loading }: { title: string, value: number | string, loading: boolean }) => (
  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
    <CardContent>
      <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
        {title}
      </Typography>
      <Typography variant="h5" component="div">
        {loading ? <CircularProgress size={24} /> : value}
      </Typography>
    </CardContent>
  </Card>
);

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_dashboard_stats');

      if (error) {
        setError(error.message);
      } else if (data && data.length > 0) {
        setStats(data[0]);
      } else {
        setError("Не удалось загрузить статистику.");
      }
      setLoading(false);
    };

    fetchStats();
  }, []);

  const freeApartments = stats ? stats.total_apartments - stats.occupied_apartments : 0;

  return (
    <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom component="div">
            Статистика
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { 
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)' 
          },
          gap: 3,
        }}>
            <StatCard title="Всего микрорайонов" value={stats?.total_microdistricts ?? 0} loading={loading} />
            <StatCard title="Всего домов" value={stats?.total_houses ?? 0} loading={loading} />
            <StatCard title="Всего квартир" value={stats?.total_apartments ?? 0} loading={loading} />
            <StatCard title="Зарегистрировано жильцов" value={stats?.total_residents ?? 0} loading={loading} />
            <StatCard title="Квартир с владельцем" value={stats?.occupied_apartments ?? 0} loading={loading} />
            <StatCard title="Незаселенные квартиры" value={freeApartments} loading={loading} />
        </Box>
    </Box>
  );
}
