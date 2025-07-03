import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Typography,
  TextField,
  TableContainer,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  TableFooter,
  TablePagination,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Stack
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';

import { supabase } from '../../../lib/supabaseClient';
import { Resident } from '../types';

// Расширяем тип Resident, чтобы включить данные из связанных таблиц
interface EnrichedResident extends Resident {
  apartments: {
    apartment_num: number;
    floor: number;
    houses: {
      house_number: string;
      microdistrict: string;
    } | null;
  } | null;
}

export default function ResidentsTable() {
  const [residents, setResidents] = useState<EnrichedResident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  // ref to hidden file input for import
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchResidents = useCallback(async () => {
    setLoading(true);
    setError(null);

    const from = page * rowsPerPage;
    const to = from + rowsPerPage - 1;

    let query = supabase
      .from('residents')
      .select(`
        *,
        apartments (
          apartment_num,
          floor,
          houses (
            house_number,
            microdistrict
          )
        )
      `, { count: 'exact' });

    if (searchTerm) {
      // Ищем по фамилии, имени или телефону
      query = query.or(`last_name.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
    }

    if (rowsPerPage > 0) {
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) {
      setError(error.message);
    } else {
      setResidents(data as EnrichedResident[] || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [page, rowsPerPage, searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchResidents();
    }, 200); // Debounce search (200 мс)
    return () => clearTimeout(timer);
  }, [fetchResidents, page, rowsPerPage, searchTerm]);

  const handleExport = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('residents')
      .select(`
        *,
        apartments (
          apartment_num,
          floor,
          houses (
            house_number,
            microdistrict
          )
        )
      `);

    setLoading(false);
    if (error) {
      alert('Ошибка экспорта: ' + error.message);
      return;
    }
    if (!data) {
        alert('Нет данных для экспорта');
        return;
    }

    const csvHeader = [
      'Имя', 'Фамилия', 'Телефон', 'Микрорайон', 'Дом', 'Квартира', 'Этаж', 'Дата заезда'
    ].join(';');

    const csvRows = data.map(resident => {
      const r = resident as EnrichedResident;
      return [
        r.first_name,
        r.last_name,
        r.phone,
        r.apartments?.houses?.microdistrict || '',
        r.apartments?.houses?.house_number || '',
        r.apartments?.apartment_num || '',
        r.apartments?.floor || '',
        r.move_in_date ? new Date(r.move_in_date).toLocaleDateString() : ''
      ].map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';');
    });

    const csvContent = [csvHeader, ...csvRows].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'residents.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const text = await file.text();
    const rows = text.split('\n').slice(1); // Skip header row

    for (const row of rows) {
      if (!row.trim()) continue; // Skip empty rows
      
      const [ 
        firstName, lastName, phone, microdistrict, houseNumber, apartmentNumStr, floorStr, moveInDate
      ] = row.split(',').map(val => val.trim().replace(/^"|"$/g, ''));

      try {
        // Step 1: Find or create the house
        let houseId: string;
        
        // First try to find existing house
        const { data: existingHouse, error: houseError } = await supabase
          .from('houses')
          .select('id')
          .eq('microdistrict', microdistrict)
          .eq('house_number', houseNumber)
          .single();

        if (houseError && houseError.code !== 'PGRST116') {
          throw new Error(`Ошибка поиска дома: ${houseError.message}`);
        }

        if (existingHouse) {
          houseId = existingHouse.id;
        } else {
          // If house doesn't exist, create it
          const { data: newHouse, error: newHouseError } = await supabase
            .from('houses')
            .insert({ microdistrict, house_number: houseNumber })
            .select('id')
            .single();
          if (newHouseError) throw new Error(`Ошибка создания дома: ${newHouseError.message}`);
          houseId = newHouse.id;
        }

        // Step 2: Find or create the apartment
        const apartmentNum = parseInt(apartmentNumStr, 10);
        const floor = parseInt(floorStr, 10);

        if (isNaN(apartmentNum) || isNaN(floor)) {
          console.warn(`Пропуск строки из-за неверного номера квартиры или этажа: ${row}`);
          continue;
        }

        let apartmentId: string;
        
        // First try to find existing apartment
        const { data: existingApartment, error: apartmentError } = await supabase
          .from('apartments')
          .select('id')
          .eq('house_id', houseId)
          .eq('apartment_num', apartmentNum)
          .single();
          
        if (apartmentError && apartmentError.code !== 'PGRST116') {
          throw new Error(`Ошибка поиска квартиры: ${apartmentError.message}`);
        }

        if (existingApartment) {
          apartmentId = existingApartment.id;
        } else {
          // If apartment doesn't exist, create it
          const { data: newApartment, error: newApartmentError } = await supabase
            .from('apartments')
            .insert({
              house_id: houseId,
              apartment_num: apartmentNum,
              floor: floor
            })
            .select('id')
            .single();
          if (newApartmentError) throw new Error(`Ошибка создания квартиры: ${newApartmentError.message}`);
          apartmentId = newApartment.id;
        }

        // Step 3: Insert the resident
        const parsedDate = new Date(moveInDate);
        if (isNaN(parsedDate.getTime())) {
// ...
            continue;
        }

        const { error: residentError } = await supabase
          .from('residents')
          .insert({
            first_name: firstName,
            last_name: lastName,
            phone,
            move_in_date: parsedDate.toISOString(),
            apartment_id: apartmentId
          });

        if (residentError) {
          console.warn(`Не удалось импортировать жильца ${firstName} ${lastName}: ${residentError.message}`);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
        setError(`Ошибка импорта строки: ${row}. ${errorMessage}`);
        break; // Stop on first error
      }
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setLoading(false);
    fetchResidents();
  };

  const handleEvict = async (residentId: number) => {
    setError(null);
    const { error: delErr } = await supabase.from('residents').delete().eq('id', residentId);
    if (delErr) {
      setError(delErr.message);
    } else {
      // Refresh data
      fetchResidents();
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt:4, mb:1 }}>
        <Typography variant="h4">Реестр собственников и арендаторов</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Экспорт CSV"><IconButton color="primary" onClick={handleExport}><DownloadIcon/></IconButton></Tooltip>
          <Tooltip title="Импорт CSV"><IconButton color="primary" onClick={handleImportClick}><UploadFileIcon/></IconButton></Tooltip>
          <input type="file" accept="text/csv" style={{display:'none'}} ref={fileInputRef} onChange={handleImport}/>
        </Stack>
      </Stack>
      <TextField
        label="Поиск (ФИО, телефон)"
        variant="outlined"
        fullWidth
        sx={{
          mb: 2,
          '& .MuiInputBase-root': {
            color: 'white', // цвет вводимого текста
          },
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: 'white', // цвет рамки
            },
            '&:hover fieldset': {
              borderColor: 'white', // цвет рамки при наведении
            },
            '&.Mui-focused fieldset': {
              borderColor: 'white', // цвет рамки при фокусе
            },
          },
          '& label': {
            color: 'white', // цвет лейбла
          },
          '& label.Mui-focused': {
            color: 'white', // цвет лейбла в фокусе
          },
        }}
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
      />
      <TableContainer component={Paper}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Имя</TableCell>
              <TableCell>Фамилия</TableCell>
              <TableCell>Телефон</TableCell>
              <TableCell>Микрорайон</TableCell>
              <TableCell>Дом</TableCell>
              <TableCell>Квартира</TableCell>
              <TableCell>Этаж</TableCell>
              <TableCell>Дата регистрации</TableCell>
              <TableCell>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center"><CircularProgress /></TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={9} align="center"><Alert severity="error">{error}</Alert></TableCell>
              </TableRow>
            ) : (
              residents.map((resident) => (
                <TableRow key={resident.id}>
                  <TableCell>{resident.first_name}</TableCell>
                  <TableCell>{resident.last_name}</TableCell>
                  <TableCell>{resident.phone}</TableCell>
                  <TableCell>{resident.apartments?.houses?.microdistrict || 'N/A'}</TableCell>
                  <TableCell>{resident.apartments?.houses?.house_number || 'N/A'}</TableCell>
                  <TableCell>{resident.apartments?.apartment_num || 'N/A'}</TableCell>
                  <TableCell>{resident.apartments?.floor || 'N/A'}</TableCell>
                  <TableCell>{new Date(resident.move_in_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      onClick={() => {
                        if (window.confirm(`Вы уверены, что хотите удалить ${resident.first_name} ${resident.last_name}?`)) {
                          handleEvict(resident.id);
                        }
                      }}
                    >
                      Удалить
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25, { label: 'Все', value: -1 }]}
                colSpan={8}
                count={totalCount}
                rowsPerPage={rowsPerPage}
                page={page}
                SelectProps={{
                  inputProps: { 'aria-label': 'строк на странице' },
                  native: true,
                }}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
              />
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
    </>
  );
}
