"use client";
import React from 'react';
import {
  Typography,
  Paper,
  Box,
  TextField,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';

interface AddHouseFormProps {
  form: { microdistrict: string; house_number: string; floors_count: number };
  setForm: React.Dispatch<React.SetStateAction<{ microdistrict: string; house_number: string; floors_count: number }>>;
  errors: { microdistrict: string; house_number: string; floors_count: string };
  handleSubmit: () => Promise<void>;
  saving: boolean;
  error: string | null;
}

export default function AddHouseForm({ form, setForm, errors, handleSubmit, saving, error }: AddHouseFormProps) {
  return (
    <>
      <Typography variant="h4" gutterBottom>Добавить дом</Typography>
      <Paper sx={{ p: 2, mb: 4 }}>
        <Box component="form" noValidate onSubmit={e => { e.preventDefault(); handleSubmit(); }} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TextField
            label="Микрорайон"
            value={form.microdistrict}
            onChange={e => setForm(f => ({ ...f, microdistrict: e.target.value }))}
            required
            error={!!errors.microdistrict}
            helperText={errors.microdistrict}
          />
          <TextField
            label="Дом"
            value={form.house_number}
            onChange={e => setForm(f => ({ ...f, house_number: e.target.value }))}
            required
            error={!!errors.house_number}
            helperText={errors.house_number}
          />
          <TextField
            label="Этажей"
            type="number"
            value={form.floors_count}
            onChange={e => setForm(f => ({ ...f, floors_count: +e.target.value }))}
            required
            error={!!errors.floors_count}
            helperText={errors.floors_count}
            InputProps={{ inputProps: { min: 1 } }}
          />
          <Button type="submit" variant="contained" disabled={saving} sx={{ mt: 1 }}>{saving ? <CircularProgress size={24} /> : 'Добавить'}</Button>
        </Box>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </Paper>
    </>
  );
}
