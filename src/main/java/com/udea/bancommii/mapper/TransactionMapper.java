package com.udea.bancommii.mapper;

import com.udea.bancommii.dto.TransactionDTO;
import com.udea.bancommii.entity.Transaction;
import org.mapstruct.Mapper;
import org.mapstruct.factory.Mappers;

@Mapper
public interface TransactionMapper {
 TransactionMapper INSTANCE = Mappers.getMapper(TransactionMapper.class);
 TransactionDTO toDTO(Transaction transaction);
}
