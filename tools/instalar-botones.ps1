# Instala los botones/macros en datos/cotizador.xlsx y crea datos/cotizador.xlsm
$ErrorActionPreference = "Stop"

$base = Join-Path $PSScriptRoot ".." | Join-Path -ChildPath "datos\cotizador.xlsx"
$vba = @'
Option Explicit

Sub GuardarCotizacion()
    Dim wsC As Worksheet, wsQ As Worksheet
    Set wsC = ThisWorkbook.Worksheets("Cotizador")
    Set wsQ = ThisWorkbook.Worksheets("Cotizaciones")

    If Trim(wsC.Range("C5").Value) = "" Then
        MsgBox "Escribe el nombre del producto en el Cotizador antes de guardar.", vbExclamation
        Exit Sub
    End If

    Dim r As Long, i As Long
    r = 0
    For i = 2 To 500
        If Trim(wsQ.Range("D" & i).Value) = "" Then r = i: Exit For
    Next i
    If r = 0 Then MsgBox "No hay filas libres en Cotizaciones.", vbCritical: Exit Sub

    Dim folioN As Long
    folioN = Application.WorksheetFunction.CountA(wsQ.Range("D2:D500")) + 1

    wsQ.Range("B" & r).Value = IIf(Trim(wsC.Range("C3").Value) = "", Format(Date, "yyyy-mm-dd"), wsC.Range("C3").Text)
    wsQ.Range("C" & r).Value = IIf(Trim(wsC.Range("C4").Value) = "", "(por definir)", wsC.Range("C4").Value)
    wsQ.Range("D" & r).Value = wsC.Range("C5").Value
    wsQ.Range("E" & r).Value = wsC.Range("C6").Value
    wsQ.Range("F" & r).Value = wsC.Range("C7").Value
    wsQ.Range("G" & r).Value = wsC.Range("C8").Value
    wsQ.Range("I" & r).Value = wsC.Range("C9").Value
    wsQ.Range("H" & r).Value = wsC.Range("C10").Value
    wsQ.Range("J" & r).Value = wsC.Range("C11").Value
    wsQ.Range("K" & r).Value = wsC.Range("C12").Value
    wsQ.Range("L" & r).Value = wsC.Range("C13").Value
    wsQ.Range("M" & r).Value = wsC.Range("C14").Value
    wsQ.Range("N" & r).Value = wsC.Range("C15").Value
    wsQ.Range("O" & r).Value = wsC.Range("C16").Value
    wsQ.Range("O" & r).NumberFormat = """Q""#,##0.00"
    wsQ.Range("AC" & r).Value = "Emitida"

    wsC.Range("C3").Value = ""
    wsC.Range("C4").Value = ""
    wsC.Range("C5").Value = ""
    wsC.Range("C8").Value = 1
    wsC.Range("C9").Value = ""
    wsC.Range("C10").Value = ""
    wsC.Range("C11").Value = 0.25
    wsC.Range("C12").Value = 0
    wsC.Range("C13").Value = "No"
    wsC.Range("C14").Value = "Ninguno"
    wsC.Range("C15").Value = "No"
    wsC.Range("C16").Value = 0

    MsgBox "Guardado como COT-" & Format(folioN, "000"), vbInformation
End Sub

Sub GuardarPrecioVenta()
    Dim wsC As Worksheet, wsQ As Worksheet
    Set wsC = ThisWorkbook.Worksheets("Cotizador")
    Set wsQ = ThisWorkbook.Worksheets("Cotizaciones")

    Dim folio As String
    folio = Trim(wsC.Range("C36").Value)
    If folio = "" Then
        MsgBox "Escribe el folio a buscar en el panel (p. ej. COT-015).", vbExclamation
        Exit Sub
    End If

    Dim found As Range
    Set found = wsQ.Range("A2:A500").Find(folio, LookIn:=xlValues, LookAt:=xlWhole)
    If found Is Nothing Then
        MsgBox "El folio """ & folio & """ no existe.", vbExclamation
        Exit Sub
    End If
    If Trim(wsC.Range("C42").Value) = "" Then
        MsgBox "Escribe el nuevo precio de venta final (fila Nuevo precio).", vbExclamation
        Exit Sub
    End If

    wsQ.Range("AA" & found.Row).Value = CDbl(wsC.Range("C42").Value)
    MsgBox "Precio de venta fijado en " & folio & ".", vbInformation
End Sub

Sub RegistrarVenta()
    Dim wsP As Worksheet, wsV As Worksheet
    Set wsP = ThisWorkbook.Worksheets("Punto de venta")
    Set wsV = ThisWorkbook.Worksheets("Ventas")

    If Trim(wsP.Range("C51").Value) = "" Then
        MsgBox "Elige un producto en la NUEVA VENTA antes de registrar.", vbExclamation
        Exit Sub
    End If
    If wsP.Range("C53").Value = "" Or Not IsNumeric(wsP.Range("C53").Value) Then
        MsgBox "El precio unitario está vacío.", vbExclamation
        Exit Sub
    End If

    Dim r As Long, i As Long
    r = 0
    For i = 2 To 500
        If Trim(wsV.Range("D" & i).Value) = "" Then r = i: Exit For
    Next i
    If r = 0 Then MsgBox "No hay filas libres en Ventas.", vbCritical: Exit Sub

    Dim numVenta As Long
    numVenta = Application.WorksheetFunction.CountA(wsV.Range("D2:D500")) + 1

    wsV.Range("B" & r).Value = IIf(wsP.Range("C49").Value = "", Date, wsP.Range("C49").Text)
    wsV.Range("C" & r).Value = IIf(Trim(wsP.Range("C50").Value) = "", "(mostrador)", wsP.Range("C50").Value)
    wsV.Range("D" & r).Value = wsP.Range("C51").Value
    wsV.Range("E" & r).Value = IIf(wsP.Range("C52").Value = "", 1, wsP.Range("C52").Value)
    wsV.Range("F" & r).Value = wsP.Range("C53").Value
    wsV.Range("F" & r).NumberFormat = """Q""#,##0.00"
    wsV.Range("H" & r).Value = wsP.Range("C54").Value

    Dim total As Double
    total = wsV.Range("J" & r).Value
    wsP.Range("C50").Value = ""
    wsP.Range("C51").Value = ""
    wsP.Range("C52").Value = 1
    wsP.Range("C53").Formula = "=IF($C$51="""","""",IFERROR(INDEX($B$5:$B$44,MATCH($C$51,$A$5:$A$44,0)),""""))"
    wsP.Range("C54").Value = "No"

    MsgBox "Venta VT-" & Format(numVenta, "000") & " registrada. Total: Q" & Format(total, "#,##0.00"), vbInformation
End Sub

Sub IrAVentas()
    ThisWorkbook.Worksheets("Ventas").Activate
End Sub

Sub IrAInventario()
    ThisWorkbook.Worksheets("Inventario").Activate
End Sub

Sub IrACotizaciones()
    ThisWorkbook.Worksheets("Cotizaciones").Activate
End Sub

Sub IrAStock()
    ThisWorkbook.Worksheets("Stock").Activate
End Sub
'@

$excel = New-Object -ComObject Excel.Application
$excel.DisplayAlerts = $false
try {
    $wb = $excel.Workbooks.Open((Resolve-Path $base).Path)

    # ---- 1) INYECTAR MACROS (antes de la migración; denombre el método Add falla después del paste) ----
    Write-Output "PASO: inyectando macros"
    for ($i = $wb.VBProject.VBComponents.Count; $i -ge 1; $i--) {
        $c = $wb.VBProject.VBComponents.Item($i)
        if ($c.Name -eq "ModuloBotones") { $wb.VBProject.VBComponents.Remove($c) }
    }
    $mod = $wb.VBProject.VBComponents.Add(1)
    $mod.Name = "ModuloBotones"
    $null = $mod.CodeModule.AddFromString($vba.Replace("`r`n", "`r").Replace("`n", "`r`n"))
    Write-Output "PASO: macros listas"

    # ---- 2) MIGRACIÓN DE DATOS: si existe un xlsm previo, copiar lo guardado por el usuario ----
    $oldPath = Join-Path $PSScriptRoot ".." | Join-Path -ChildPath "datos\cotizador.xlsm"
    if (Test-Path $oldPath) {
        $old = $excel.Workbooks.Open((Resolve-Path $oldPath).Path)
        $map = @(
            @{ o = "Cotizaciones";  s = "B2:O500";    n = "Cotizaciones";    d = "B2:O500" }
            @{ o = "Cotizaciones";  s = "AC2:AC500";  n = "Cotizaciones";    d = "AC2:AC500" }
            @{ o = "Stock";         s = "C4:C17";     n = "Stock";           d = "C4:C17" }
            @{ o = "Stock";         s = "E4:E17";     n = "Stock";           d = "E4:E17" }
            @{ o = "Stock";         s = "G4:G17";     n = "Stock";           d = "H4:H17" }
            @{ o = "Stock";         s = "A255:E454";  n = "Stock";           d = "A255:E454" }
            @{ o = "Inventario";    s = "D4:D48";     n = "Inventario";      d = "D4:D48" }
            @{ o = "Inventario";    s = "E4:E48";     n = "Inventario";      d = "G4:G48" }
            @{ o = "Inventario";    s = "A52:C251";   n = "Inventario";      d = "A52:C251" }
            @{ o = "Ventas";        s = "B2:F500";    n = "Ventas";          d = "B2:F500" }
            @{ o = "Ventas";        s = "H2:H500";    n = "Ventas";          d = "H2:H500" }
            @{ o = "Ventas";        s = "M4:M103";    n = "Ventas";          d = "M4:M103" }
            @{ o = "Punto de venta"; s = "A5:A44";    n = "Punto de venta";  d = "A5:A44" }
            @{ o = "Punto de venta"; s = "B5:B44";    n = "Punto de venta";  d = "B5:B44" }
            @{ o = "Punto de venta"; s = "D5:D44";    n = "Punto de venta";  d = "D5:D44" }
            @{ o = "Punto de venta"; s = "A63:E131";  n = "Punto de venta";  d = "A63:E131" }
        )
        foreach ($m in $map) {
            Write-Output "MIG: $($m.o) $($m.s)"
            $src = $old.Worksheets($m.o).Range($m.s)
            $dst = $wb.Worksheets($m.n).Range($m.d)
            try { $dst.Value2 = $src.Value2 } catch {
                Write-Output "MIG: fallback copiar $($m.s)"
                $src.Copy()
                $null = $dst.PasteSpecial(-4163)
                $excel.CutCopyMode = 0
            }
        }
        # AA (precio venta final): copiar SOLO celdas tecleadas (constantes), conservar las del template
        Write-Output "MIG: AA constants"
        for ($r = 2; $r -le 500; $r++) {
            $cell = $old.Worksheets("Cotizaciones").Range("AA$r")
            if ($cell.Formula -notlike "=*") { $wb.Worksheets("Cotizaciones").Range("AA$r").Value2 = $cell.Value2 }
        }
        Write-Output "MIG: cerrando viejo"
        $old.Close($false)
        Write-Output "MIGRADA la data del xlsm anterior"
    }

    # ---- 3) BOTONES EN Cotizador ----
    $wsC = $wb.Worksheets("Cotizador")
    try { ($wsC.Buttons()).Delete() | Out-Null } catch {}

    $b1 = ($wsC.Buttons()).Add($wsC.Range("E2").Left, $wsC.Range("C3").Top, 150, 62)
    $b1.Caption = "GUARDAR COTIZACION"
    $b1.OnAction = "GuardarCotizacion"
    $b1.Font.Size = 11
    $b1.Font.Bold = $true

    $b2 = ($wsC.Buttons()).Add($wsC.Range("D42").Left, $wsC.Range("D42").Top, 140, 24)
    $b2.Caption = "GUARDAR PRECIO VENTA"
    $b2.OnAction = "GuardarPrecioVenta"
    $b2.Font.Size = 9

    $nav1 = ($wsC.Buttons()).Add($wsC.Range("E3").Left, $wsC.Range("E3").Top, 105, 28)
    $nav1.Caption = "COTIZACIONES"
    $nav1.OnAction = "IrACotizaciones"

    $nav2 = ($wsC.Buttons()).Add($wsC.Range("F3").Left, $wsC.Range("F3").Top, 85, 28)
    $nav2.Caption = "STOCK"
    $nav2.OnAction = "IrAStock"

    $nav3 = ($wsC.Buttons()).Add($wsC.Range("G3").Left, $wsC.Range("G3").Top, 105, 28)
    $nav3.Caption = "INVENTARIO"
    $nav3.OnAction = "IrAInventario"

    # Botones en Punto de venta
    $wsP = $wb.Worksheets("Punto de venta")
    try { ($wsP.Buttons()).Delete() | Out-Null } catch {}

    $b3 = ($wsP.Buttons()).Add($wsP.Range("E49").Left, $wsP.Range("E49").Top, 145, 62)
    $b3.Caption = "REGISTRAR VENTA"
    $b3.OnAction = "RegistrarVenta"
    $b3.Font.Size = 11
    $b3.Font.Bold = $true

    $b4 = ($wsP.Buttons()).Add($wsP.Range("E56").Left, $wsP.Range("E56").Top, 120, 26)
    $b4.Caption = "VENTAS (DETALLE)"
    $b4.OnAction = "IrAVentas"
    $b4.Font.Size = 9

    $b5 = ($wsP.Buttons()).Add($wsP.Range("F56").Left, $wsP.Range("F56").Top, 85, 26)
    $b5.Caption = "STOCK"
    $b5.OnAction = "IrAStock"
    $b5.Font.Size = 9

    $b6 = ($wsP.Buttons()).Add($wsP.Range("G56").Left, $wsP.Range("G56").Top, 110, 26)
    $b6.Caption = "INVENTARIO"
    $b6.OnAction = "IrAInventario"
    $b6.Font.Size = 9

    $dest = Join-Path $PSScriptRoot ".." | Join-Path -ChildPath "datos\cotizador.xlsm"
    if (Test-Path $dest) { Remove-Item $dest -Force }
    Write-Output "PASO: guardando xlsm"
    $wb.SaveAs($dest, 52)
    $wb.Close($true)
    Write-Output "OK: datos/cotizador.xlsm con botones creado"
}
finally {
    $excel.quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}

